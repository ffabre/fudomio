"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createProduct, updateProduct } from "@/features/catalog/actions";
import type { ActionError } from "@/features/catalog/action-result";
import {
  fieldAria,
  FormBanner,
  FormField,
  touchButtonClass,
} from "@/features/catalog/form-field";
import type {
  CatalogCategory,
  CatalogProductView,
  CatalogSubcategory,
} from "@/features/catalog/types";

export function ProductDialog({
  product,
  categories,
  subcategories,
  initialCategoryId,
  initialSubcategoryId,
  onClose,
}: {
  product?: CatalogProductView;
  categories: CatalogCategory[];
  subcategories: CatalogSubcategory[];
  initialCategoryId: number | null;
  initialSubcategoryId: number | null;
  onClose: () => void;
}) {
  const t = useTranslations("products");
  const errors = useTranslations("errors");
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product?.priceLabel ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [isAvailable, setIsAvailable] = useState(product?.isAvailable ?? true);
  const [categoryChoice, setCategoryChoice] = useState(
    product
      ? String(product.categoryId)
      : initialCategoryId
        ? String(initialCategoryId)
        : "",
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [subcategoryChoice, setSubcategoryChoice] = useState(
    product
      ? String(product.subcategoryId)
      : initialSubcategoryId
        ? String(initialSubcategoryId)
        : "",
  );
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();

  const subcategoryOptions =
    categoryChoice === "" || categoryChoice === "new"
      ? []
      : subcategories.filter(
          (subcategory) => String(subcategory.categoryId) === categoryChoice,
        );

  function message(field: ActionError["field"]) {
    if (!error || error.field !== field) return undefined;
    return errors(error.code);
  }

  function onCategoryChange(value: string) {
    setCategoryChoice(value);
    setError(null);
    if (value === "new") {
      setSubcategoryChoice("new");
      return;
    }
    if (subcategoryChoice === "new") return;
    const selected = subcategories.find(
      (subcategory) => String(subcategory.id) === subcategoryChoice,
    );
    if (!selected || String(selected.categoryId) !== value) {
      setSubcategoryChoice("");
    }
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const creatingCategory = categoryChoice === "new";
    const creatingSubcategory =
      creatingCategory || subcategoryChoice === "new";
    const payload = {
      name,
      description,
      price,
      isAvailable,
      categoryId:
        creatingCategory || categoryChoice === "" ? null : Number(categoryChoice),
      newCategoryName: creatingCategory ? newCategoryName : null,
      subcategoryId:
        creatingSubcategory || subcategoryChoice === ""
          ? null
          : Number(subcategoryChoice),
      newSubcategoryName: creatingSubcategory ? newSubcategoryName : null,
    };

    startTransition(async () => {
      const result = product
        ? await updateProduct({ id: product.id, ...payload })
        : await createProduct(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t("saved"));
      onClose();
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
      >
        <form onSubmit={onFormSubmit} className="flex flex-col gap-4">
          <DialogHeader className="pe-8">
            <DialogTitle>
              {product ? t("editProductTitle") : t("createProductTitle")}
            </DialogTitle>
          </DialogHeader>
          <FormField id="product-name" label={t("name")} error={message("name")}>
            <Input
              {...fieldAria("product-name", message("name"))}
              value={name}
              disabled={pending}
              autoFocus
              className="h-11 min-h-11 text-base"
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
            />
          </FormField>
          <FormField id="product-price" label={t("price")} error={message("price")}>
            <Input
              {...fieldAria("product-price", message("price"))}
              value={price}
              disabled={pending}
              inputMode="decimal"
              autoComplete="off"
              className="h-11 min-h-11 text-base"
              onChange={(event) => {
                setPrice(event.target.value);
                setError(null);
              }}
            />
          </FormField>
          <FormField
            id="product-description"
            label={t("description")}
            error={message("description")}
          >
            <Textarea
              {...fieldAria("product-description", message("description"))}
              value={description}
              disabled={pending}
              onChange={(event) => {
                setDescription(event.target.value);
                setError(null);
              }}
            />
          </FormField>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="size-5"
              checked={isAvailable}
              disabled={pending}
              onChange={(event) => setIsAvailable(event.target.checked)}
            />
            {t("available")}
          </label>
          <FormField
            id="product-category"
            label={t("category")}
            error={categoryChoice === "new" ? undefined : message("category")}
          >
            <NativeSelect
              {...fieldAria(
                "product-category",
                categoryChoice === "new" ? undefined : message("category"),
              )}
              value={categoryChoice}
              disabled={pending}
              onChange={(event) => onCategoryChange(event.target.value)}
            >
              <option value="">{t("chooseCategory")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
              <option value="new">{t("newCategory")}</option>
            </NativeSelect>
          </FormField>
          {categoryChoice === "new" ? (
            <FormField
              id="product-new-category"
              label={t("newCategory")}
              error={message("category")}
            >
              <Input
                {...fieldAria("product-new-category", message("category"))}
                value={newCategoryName}
                disabled={pending}
                className="h-11 min-h-11 text-base"
                onChange={(event) => {
                  setNewCategoryName(event.target.value);
                  setError(null);
                }}
              />
            </FormField>
          ) : null}
          {categoryChoice !== "new" ? (
            <FormField
              id="product-subcategory"
              label={t("subcategory")}
              error={subcategoryChoice === "new" ? undefined : message("subcategory")}
            >
              <NativeSelect
                {...fieldAria(
                  "product-subcategory",
                  subcategoryChoice === "new" ? undefined : message("subcategory"),
                )}
                value={subcategoryChoice}
                disabled={pending || categoryChoice === ""}
                onChange={(event) => {
                  setSubcategoryChoice(event.target.value);
                  setError(null);
                }}
              >
                <option value="">{t("chooseSubcategory")}</option>
                {subcategoryOptions.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
                <option value="new">{t("newSubcategory")}</option>
              </NativeSelect>
            </FormField>
          ) : null}
          {categoryChoice === "new" || subcategoryChoice === "new" ? (
            <FormField
              id="product-new-subcategory"
              label={t("newSubcategory")}
              error={message("subcategory")}
            >
              <Input
                {...fieldAria("product-new-subcategory", message("subcategory"))}
                value={newSubcategoryName}
                disabled={pending}
                className="h-11 min-h-11 text-base"
                onChange={(event) => {
                  setNewSubcategoryName(event.target.value);
                  setError(null);
                }}
              />
            </FormField>
          ) : null}
          <FormBanner
            message={error && !error.field ? errors(error.code) : undefined}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={touchButtonClass}
              onClick={onClose}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" className={touchButtonClass} disabled={pending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
