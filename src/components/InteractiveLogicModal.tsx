import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import {
  interactiveLogicAtom,
  interactiveLogicModalAtom,
  type InteractiveLogicEntity,
} from "~/store/interactiveLogicStore";
import { toast } from "react-hot-toast";
import { XMarkIcon } from "@heroicons/react/24/outline";

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

export const InteractiveLogicModal = () => {
  const [modalState, setModalState] = useAtom(interactiveLogicModalAtom);
  const [logicEntities, setLogicEntities] = useAtom(interactiveLogicAtom);
  const [name, setName] = useState("");
  const [logic, setLogic] = useState("");
  const [saving, setSaving] = useState(false);

  const isOpen = modalState.isOpen;

  const editingEntity: InteractiveLogicEntity | undefined = useMemo(() => {
    if (!modalState.entityId) return undefined;
    return logicEntities.find((entity) => entity.id === modalState.entityId);
  }, [logicEntities, modalState.entityId]);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setLogic("");
      setSaving(false);
      return;
    }

    if (modalState.mode === "create") {
      const defaultName =
        modalState.elementDetail?.elementName ?? "Interaction logic";
      setName(defaultName);
      setLogic("");
    } else if (modalState.mode === "edit" && editingEntity) {
      setName(editingEntity.name);
      setLogic(editingEntity.logic);
    }
  }, [editingEntity, isOpen, modalState]);

  const closeModal = () => {
    setModalState({ isOpen: false, mode: "create" });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please give this interaction logic a name.");
      return;
    }

    if (!logic.trim()) {
      toast.error("Please describe the interaction logic.");
      return;
    }

    setSaving(true);
    const now = Date.now();

    if (modalState.mode === "create") {
      const elementDetail = modalState.elementDetail;
      if (!elementDetail) {
        toast.error(
          "Missing element information—unable to create interaction logic.",
        );
        setSaving(false);
        return;
      }

      const newEntity: InteractiveLogicEntity = {
        id: createId(),
        name: name.trim(),
        logic: logic.trim(),
        elementName: elementDetail.elementName,
        elementContent: elementDetail.elementContent,
        createdAt: now,
        updatedAt: now,
      };

      setLogicEntities((prev) => [...prev, newEntity]);

      window.dispatchEvent(
        new CustomEvent("logicEntityUpdated", {
          detail: {
            id: newEntity.id,
            name: newEntity.name,
            logic: newEntity.logic,
            elementName: newEntity.elementName,
          },
        }),
      );

      toast.success("Interaction logic saved.");
    } else if (modalState.mode === "edit" && modalState.entityId) {
      let updatedEntity: InteractiveLogicEntity | undefined = undefined;

      setLogicEntities((prev) =>
        prev.map((entity) => {
          if (entity.id === modalState.entityId) {
            updatedEntity = {
              ...entity,
              name: name.trim(),
              logic: logic.trim(),
              updatedAt: now,
            };
            return updatedEntity;
          }
          return entity;
        }),
      );

      if (updatedEntity) {
        window.dispatchEvent(
          new CustomEvent("logicEntityUpdated", {
            detail: {
              id: updatedEntity.id,
              name: updatedEntity.name,
              logic: updatedEntity.logic,
              elementName: updatedEntity.elementName,
            },
          }),
        );
        toast.success("Interaction logic updated.");
      }
    }

    setSaving(false);
    closeModal();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={closeModal}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-start justify-between">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    {modalState.mode === "create"
                      ? "Save interaction logic"
                      : "Edit interaction logic"}
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                    onClick={closeModal}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {modalState.elementDetail && modalState.mode === "create" && (
                  <div className="mt-4 rounded-lg bg-gray-100 p-3 text-sm text-gray-600">
                    <div className="font-medium text-gray-800">
                      Selected element
                    </div>
                    <div className="mt-1 text-gray-700">
                      {modalState.elementDetail.elementName}
                    </div>
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  <div>
                    <label
                      htmlFor="interactive-logic-name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Name
                    </label>
                    <input
                      id="interactive-logic-name"
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Example: Validation logic after clicking the submit button"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="interactive-logic-content"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Interaction logic description
                    </label>
                    <textarea
                      id="interactive-logic-content"
                      value={logic}
                      onChange={(event) => setLogic(event.target.value)}
                      rows={6}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Describe the interaction logic or flow, e.g., when a user clicks Submit, show a warning if the form is incomplete."
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
