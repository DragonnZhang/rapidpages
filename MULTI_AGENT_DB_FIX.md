# 多智能体测试循环数据库持久化修复

## 问题描述

当测试失败后，系统通过 `reviseComponent` 优化 UI，但新的 UI 只存储在内存中（`uiVersionsStore`），没有保存到数据库。这导致：

1. `/c/[id]` 页面的 UI 不会自动更新
2. 数据库中没有新的 revision 记录
3. 后续测试仍然在测试旧的 UI 代码

## 解决方案

参考 `Chat.tsx` 中使用 `api.component.makeRevision` 的模式，在 `runIterativeTestingLoop` 函数中添加数据库持久化逻辑。

## 代码改动

### 1. 更新 `runIterativeTestingLoop` 函数签名

**文件**: `src/server/api/routers/multiAgent.ts`

```typescript
// 添加 ctx 参数用于访问数据库，添加 baseRevisionId 参数
async function runIterativeTestingLoop(
  testRunId: string,
  requirement: UserRequirement,
  initialUiVersion: UiVersion,
  testCases: TestCase[],
  ctx: { db: any },  // ✅ 新增
  baseRevisionId?: string,  // ✅ 新增
): Promise<{ 
  iterations: IterationCycle[]; 
  finalStatus: TestRunStatus;
  latestRevisionId?: string;  // ✅ 新增
}>
```

### 2. 在 UI 优化后保存到数据库

```typescript
// 优化 UI 后，立即保存到数据库
const newRevision = await ctx.db.componentRevision.create({
  data: {
    componentId: currentUiVersion.componentId,
    code: JSON.stringify(optimizedFiles),
    prompt: `Multi-agent optimization (iteration ${iteration}): ${optimizationSummary}`,
  },
});

console.log(
  `[MultiAgent] Created new revision ${newRevision.id} for iteration ${iteration}`,
);

// 更新 component 的 code 字段为最新版本
await ctx.db.component.update({
  where: { id: currentUiVersion.componentId },
  data: { code: JSON.stringify(optimizedFiles) },
});

// 创建内存中的 UiVersion 对象（保持原有逻辑）
const newUiVersionId = `ui_${testRunId}_${iteration}`;
currentUiVersion = {
  id: newUiVersionId,
  componentId: currentUiVersion.componentId,
  versionIndex: iteration,
  files: optimizedFiles,
  revisionId: newRevision.id,  // ✅ 关联数据库记录
  createdAt: new Date().toISOString(),
  createdBy: "optimizer",
  sourceFailureTestCaseId: failedResults[0]?.testCaseId,
};
```

### 3. 返回最新的 revisionId

```typescript
return {
  iterations,
  finalStatus,
  latestRevisionId: currentUiVersion.revisionId,  // ✅ 返回最新 revision ID
};
```

### 4. 更新 `startRun` mutation 调用

```typescript
const { iterations, finalStatus, latestRevisionId } = await runIterativeTestingLoop(
  testRunId,
  requirement,
  uiVersion,
  testCases,
  ctx,  // ✅ 传递 ctx
  uiVersion.revisionId,  // ✅ 传递初始 revision ID
);

// 在返回值中包含最新的 revisionId
return {
  testRunId,
  initialUiVersionId,
  requirementId,
  latestRevisionId,  // ✅ 返回给前端
};
```

### 5. 前端自动刷新页面

**文件**: `src/components/MultiAgentTestPanel.tsx`

```typescript
// 测试启动时，保存 revisionId 到 localStorage
const result = await startRunMutation.mutateAsync({...});

if (result.latestRevisionId) {
  console.log("🔄 [Frontend] New revision created:", result.latestRevisionId);
  localStorage.setItem(`test_${result.testRunId}_newRevision`, result.latestRevisionId);
}

// 测试完成后检查是否有新 revision，如果有则刷新页面
useEffect(() => {
  if (reportData) {
    const newRevisionId = localStorage.getItem(`test_${testRunId}_newRevision`);
    if (newRevisionId) {
      console.log("🔄 [Frontend] UI was optimized, reloading page...");
      localStorage.removeItem(`test_${testRunId}_newRevision`);
      setTimeout(() => {
        router.reload();  // 刷新页面显示新 UI
      }, 2000);
    }
  }
}, [reportData, testRunId, router]);
```

## 工作流程

1. **测试失败**: MCP 测试检测到 UI 问题
2. **优化 UI**: `optimizeUiForFailures` 生成新的组件代码
3. **保存到数据库**:
   - 创建新的 `ComponentRevision` 记录
   - 更新 `Component.code` 字段
4. **前端通知**: 返回 `latestRevisionId` 给前端
5. **自动刷新**: 测试完成后，前端自动刷新页面显示新 UI
6. **后续测试**: 新的测试迭代会基于最新的数据库版本

## 数据流

```
测试失败 → 优化 UI → Prisma 创建 revision 
                    ↓
                   更新 Component.code
                    ↓
                   返回 revisionId 
                    ↓
                   前端保存到 localStorage
                    ↓
                   测试完成后刷新页面
                    ↓
                   显示最新 UI
```

## 验证方法

1. 在 `/new` 页面生成一个有问题的 UI（比如缺少某个功能）
2. 自动跳转到 `/c/[id]?autoTest=true` 并开始测试
3. 测试失败后，查看数据库是否创建了新的 revision
4. 等待测试完成，页面应该自动刷新
5. 刷新后的页面应该显示优化后的 UI
6. 可以在数据库中验证 `ComponentRevision` 表有新记录

## 数据库查询验证

```sql
-- 查看某个 component 的所有 revisions
SELECT id, prompt, "createdAt" 
FROM "ComponentRevision" 
WHERE "componentId" = 'your-component-id'
ORDER BY "createdAt" DESC;

-- 查看最新的 component code 是否更新
SELECT id, code 
FROM "Component" 
WHERE id = 'your-component-id';
```

## 关键改进

✅ **数据持久化**: 优化后的 UI 现在保存到 PostgreSQL 数据库  
✅ **UI 同步**: Component 表的 code 字段实时更新为最新版本  
✅ **前端刷新**: 测试完成后自动刷新页面显示新 UI  
✅ **关联追踪**: UiVersion 通过 revisionId 关联到数据库记录  
✅ **调试日志**: 添加了详细的日志输出用于追踪保存过程

## 注意事项

- 页面刷新有 2 秒延迟，给用户时间查看测试报告
- 使用 localStorage 临时存储 revisionId，测试完成后自动清理
- 每次迭代都会创建新的 revision，保持完整的版本历史
- Component.code 始终指向最新版本，保证测试的是最新代码
