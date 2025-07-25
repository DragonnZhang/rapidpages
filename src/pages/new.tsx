import { useSession } from "next-auth/react";
import { useState, type ReactElement, Fragment } from "react";
import { ApplicationLayout } from "~/components/AppLayout";
import { ChevronRightIcon, CommandLineIcon } from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";
import { Spinner } from "~/components/Spinner";
import Image from "next/image";
import { api } from "~/utils/api";
import toast from "react-hot-toast";
import router from "next/router";
import { type NextPageWithLayout } from "./_app";
import { RichTextInput } from "~/components/RichTextInput";
import { type RichTextContent } from "~/types/multimodal";

const items = [
  {
    name: "CTA for a landing page",
    description:
      "A section with a header text, subheader text and a CTA button with a link to a page. All centered. The background is a gradient from blue to purple. The text is white. The CTA button is purple.",
  },
  {
    name: "Features of a product",
    description:
      "A section with header text, subheader text, and a centered 2x2 grid to explain the features of the product. The background is gray colored, the text is colored white.",
  },
  {
    name: "Product Cards",
    description:
      "A section with a 2 product cards centered. Product cards with a product image, product name, product description, and a CTA button. The background is white, the text is black. The CTA button is purple.",
  },
];

const loadingItems = [
  {
    image: "/images/compiling.png",
    subtext: "Code is generating, enjoy your break",
    xkcd: 303,
  },
  {
    image: "/images/estimation.png",
    subtext: "Why there are no time estimates on this product",
    xkcd: 612,
  },
  {
    image: "/images/machine_learning.png",
    subtext: "Modifying prompts slightly can change the output",
    xkcd: 1838,
  },
];

const NewPage: NextPageWithLayout = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const generateComponent = api.component.createComponent.useMutation();
  const { data: session } = useSession();
  const randomItem =
    loadingItems[Math.floor(Math.random() * loadingItems.length)]!;

  const handleGenerateComponent = async (content: RichTextContent) => {
    if (!session) {
      return router.push("/login");
    }

    // Prevent double submission
    if (isGenerating) return;

    setIsGenerating(true);

    try {
      console.log("🚀 ~ handleGenerateComponent content:", content);

      const result = await generateComponent.mutateAsync({
        prompt: content.text,
        media: content.media,
      });

      console.log("🚀 ~ handleGenerateComponent result:", result);

      if (result.status === "error") {
        throw new Error("Failed to generate component");
      }
      const { componentId } = result.data;
      await router.push(`/c/${componentId}`);
      return;
    } catch (e) {
      console.error("🚀 ~ handleGenerateComponent error:", e);
      setIsGenerating(false);
      toast.error("Failed to generate component");
      return;
    }
  };

  return (
    <div className="flex h-full flex-grow flex-col">
      <div className="flex min-w-0 flex-grow bg-neutral-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <Transition appear show={isGenerating} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={() => {}}>
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="fixed inset-0 bg-black bg-opacity-25" />
              </Transition.Child>

              <div className="fixed inset-0 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                  >
                    <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                      <Dialog.Title>
                        <Spinner
                          label="Generating..."
                          className="text-md font-medium text-gray-600"
                        />
                      </Dialog.Title>
                      <div className="mt-2 justify-center">
                        <p className="text-center text-sm text-gray-500">
                          Please be patient while things are being generated.
                        </p>
                        <Image
                          src={randomItem.image}
                          alt="Compiling"
                          width={300}
                          height={300}
                          className="mx-auto mt-8"
                        />
                      </div>
                      <p className="mt-1 text-center text-xs text-gray-500">
                        {`${randomItem.subtext} (`}
                        <a
                          href={`https://xkcd.com/${randomItem.xkcd}`}
                          target="_blank noreferer"
                          className="text-indigo-600 hover:text-indigo-500"
                        >
                          xkcd
                        </a>
                        )
                      </p>
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition>
          <div className="relative mx-5 my-64 sm:mx-10 md:mx-32">
            <RichTextInput
              onSubmit={handleGenerateComponent}
              disabled={isGenerating}
              placeholder="描述您想要的组件，可以上传图片作为参考..."
              rows={3}
            />
          </div>

          <h2 className="text-base font-semibold leading-6 text-gray-900">
            Need some inspiration?
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Checkout the following prompts to get started.
          </p>
          <ul
            role="list"
            className="mt-6 divide-y divide-gray-200 border-b border-t border-gray-200"
          >
            {items.map((item, itemIdx) => (
              <li key={itemIdx}>
                <div className="group relative flex items-start space-x-3 py-4">
                  <div className="flex-shrink-0">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500">
                      <CommandLineIcon
                        className="h-6 w-6 text-white"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleGenerateComponent({
                            text: item.description,
                            media: [],
                          });
                        }}
                        disabled={isGenerating}
                      >
                        <span className="absolute inset-0" aria-hidden="true" />
                        {item.name}
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                  <div className="flex-shrink-0 self-center">
                    <ChevronRightIcon
                      className="h-5 w-5 text-gray-400 group-hover:text-gray-500"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex">
            {/* <Link
              href="#"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Or check what others have created
              <span aria-hidden="true"> &rarr;</span>
            </Link> */}
          </div>
        </div>
      </div>
    </div>
  );
};

NewPage.getLayout = (page: ReactElement) => (
  <ApplicationLayout title="Create a new component">{page}</ApplicationLayout>
);

export default NewPage;
