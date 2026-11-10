"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteProduct,
  deleteSubcategory,
  renameCategory,
  renameSubcategory,
} from "@/features/catalog/actions";
import { DeleteDialog } from "@/features/catalog/delete-dialog";
import { touchButtonClass } from "@/features/catalog/form-field";
import { NameDialog } from "@/features/catalog/name-dialog";
import { ProductDialog } from "@/features/catalog/product-dialog";
import type {
  CatalogProductView,
  CatalogView,
} from "@/features/catalog/types";

type DialogState =
  | { type: "create-category" }
  | { type: "rename-category"; id: number; name: string }
  | { type: "delete-category"; id: number; name: string }
  | { type: "create-subcategory" }
  | { type: "rename-subcategory"; id: number; name: string }
  | { type: "delete-subcategory"; id: number; name: string }
  | { type: "create-product" }
  | { type: "edit-product"; product: CatalogProductView }
  | { type: "delete-product"; product: CatalogProductView };

const columns =
  "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem_6.5rem_auto]";

export function CatalogScreen({ catalog }: { catalog: CatalogView }) {
  const t = useTranslations("products");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const selectedCategory =
    catalog.categories.find((category) => category.id === categoryId) ?? null;
  const subcategoryChoices = selectedCategory
    ? catalog.subcategories.filter(
        (subcategory) => subcategory.categoryId === selectedCategory.id,
      )
    : catalog.subcategories;
  const selectedSubcategory =
    subcategoryChoices.find((subcategory) => subcategory.id === subcategoryId) ??
    null;
  const activeCategoryId = selectedCategory?.id ?? null;
  const activeSubcategoryId = selectedSubcategory?.id ?? null;
  const filtered = catalog.products.filter((product) => {
    if (activeCategoryId !== null && product.categoryId !== activeCategoryId) {
      return false;
    }
    if (
      activeSubcategoryId !== null &&
      product.subcategoryId !== activeSubcategoryId
    ) {
      return false;
    }
    return true;
  });

  const categoryOptions = catalog.categories.map((category) => ({
    id: category.id,
    name: category.name,
    label: category.name,
  }));
  const subcategoryOptions = subcategoryChoices.map((subcategory) => {
    const category = catalog.categories.find(
      (item) => item.id === subcategory.categoryId,
    );
    const label =
      selectedCategory || !category
        ? subcategory.name
        : `${subcategory.name} · ${category.name}`;
    return { id: subcategory.id, name: subcategory.name, label };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <FilterGroup
          id="category-filter"
          label={t("category")}
          value={selectedCategory ? String(selectedCategory.id) : "all"}
          options={categoryOptions}
          addLabel={t("addCategory")}
          onChange={(value) => {
            setCategoryId(value === "all" ? null : Number(value));
            setSubcategoryId(null);
          }}
          onAdd={() => setDialog({ type: "create-category" })}
          onRename={() => {
            if (!selectedCategory) return;
            setDialog({
              type: "rename-category",
              id: selectedCategory.id,
              name: selectedCategory.name,
            });
          }}
          onDelete={() => {
            if (!selectedCategory) return;
            setDialog({
              type: "delete-category",
              id: selectedCategory.id,
              name: selectedCategory.name,
            });
          }}
        />
        <FilterGroup
          id="subcategory-filter"
          label={t("subcategory")}
          value={selectedSubcategory ? String(selectedSubcategory.id) : "all"}
          options={subcategoryOptions}
          addLabel={t("addSubcategory")}
          onChange={(value) => {
            setSubcategoryId(value === "all" ? null : Number(value));
          }}
          onAdd={() => setDialog({ type: "create-subcategory" })}
          onRename={() => {
            if (!selectedSubcategory) return;
            setDialog({
              type: "rename-subcategory",
              id: selectedSubcategory.id,
              name: selectedSubcategory.name,
            });
          }}
          onDelete={() => {
            if (!selectedSubcategory) return;
            setDialog({
              type: "delete-subcategory",
              id: selectedSubcategory.id,
              name: selectedSubcategory.name,
            });
          }}
        />
      </div>

      <div>
        <Button
          type="button"
          className={touchButtonClass}
          onClick={() => setDialog({ type: "create-product" })}
        >
          {t("addProduct")}
        </Button>
      </div>

      {catalog.products.length === 0 ? (
        <p className="text-base text-muted-foreground">{t("emptyCatalog")}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-base text-muted-foreground">{t("emptyFilter")}</p>
          <Button
            type="button"
            variant="outline"
            className={touchButtonClass}
            onClick={() => {
              setCategoryId(null);
              setSubcategoryId(null);
            }}
          >
            {t("clearFilters")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div
            className={`hidden px-4 text-sm font-medium text-muted-foreground lg:grid lg:gap-4 ${columns}`}
          >
            <span>{t("name")}</span>
            <span>{t("category")}</span>
            <span>{t("subcategory")}</span>
            <span>{t("price")}</span>
            <span>{t("status")}</span>
            <span className="sr-only">{t("actions")}</span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {filtered.map((product) => (
              <li
                key={product.id}
                className={`grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:items-center lg:gap-4 ${columns}`}
              >
                <Cell label={t("name")}>
                  <p className="text-base font-medium break-words">{product.name}</p>
                </Cell>
                <Cell label={t("category")}>
                  <p className="break-words">{product.categoryName}</p>
                </Cell>
                <Cell label={t("subcategory")}>
                  <p className="break-words">{product.subcategoryName}</p>
                </Cell>
                <Cell label={t("price")}>
                  <p className="tabular-nums">{product.priceLabel}</p>
                </Cell>
                <Cell label={t("status")}>
                  <Badge variant={product.isAvailable ? "secondary" : "outline"}>
                    {product.isAvailable ? t("availableBadge") : t("hiddenBadge")}
                  </Badge>
                </Cell>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className={touchButtonClass}
                    aria-label={t("editNamed", { name: product.name })}
                    onClick={() => setDialog({ type: "edit-product", product })}
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className={touchButtonClass}
                    aria-label={t("deleteNamed", { name: product.name })}
                    onClick={() => setDialog({ type: "delete-product", product })}
                  >
                    {t("delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dialog?.type === "create-category" ? (
        <NameDialog
          title={t("createCategoryTitle")}
          initialName=""
          onSubmit={(value) => createCategory({ name: value.name })}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.type === "rename-category" ? (
        <NameDialog
          key={dialog.id}
          title={t("renameCategoryTitle")}
          initialName={dialog.name}
          onSubmit={(value) =>
            renameCategory({ id: dialog.id, name: value.name })
          }
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.type === "create-subcategory" ? (
        <NameDialog
          title={t("createSubcategoryTitle")}
          initialName=""
          categoryField={
            selectedCategory
              ? {
                  mode: "fixed",
                  id: selectedCategory.id,
                  name: selectedCategory.name,
                }
              : { mode: "select", categories: catalog.categories }
          }
          onSubmit={(value) =>
            createSubcategory({
              name: value.name,
              categoryId: value.categoryId ?? Number.NaN,
            })
          }
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.type === "rename-subcategory" ? (
        <NameDialog
          key={dialog.id}
          title={t("renameSubcategoryTitle")}
          initialName={dialog.name}
          onSubmit={(value) =>
            renameSubcategory({ id: dialog.id, name: value.name })
          }
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.type === "delete-category" ? (
        <DeleteDialog
          title={t("deleteCategoryTitle")}
          body={t("deleteCategoryBody", { name: dialog.name })}
          onDelete={() => deleteCategory(dialog.id)}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.type === "delete-subcategory" ? (
        <DeleteDialog
          title={t("deleteSubcategoryTitle")}
          body={t("deleteSubcategoryBody", { name: dialog.name })}
          onDelete={() => deleteSubcategory(dialog.id)}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.type === "delete-product" ? (
        <DeleteDialog
          title={t("deleteProductTitle")}
          body={t("deleteProductBody", { name: dialog.product.name })}
          onDelete={() => deleteProduct(dialog.product.id)}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.type === "create-product" || dialog?.type === "edit-product" ? (
        <ProductDialog
          key={dialog.type === "edit-product" ? dialog.product.id : "new"}
          product={dialog.type === "edit-product" ? dialog.product : undefined}
          categories={catalog.categories}
          subcategories={catalog.subcategories}
          initialCategoryId={
            selectedSubcategory?.categoryId ?? selectedCategory?.id ?? null
          }
          initialSubcategoryId={selectedSubcategory?.id ?? null}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function FilterGroup({
  id,
  label,
  value,
  options,
  addLabel,
  onChange,
  onAdd,
  onRename,
  onDelete,
}: {
  id: string;
  label: string;
  value: string;
  options: { id: number; name: string; label: string }[];
  addLabel: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("products");
  const selected = options.find((option) => String(option.id) === value);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">{t("all")}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className={touchButtonClass}
          onClick={onAdd}
        >
          {addLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={touchButtonClass}
          disabled={!selected}
          aria-label={selected ? t("renameNamed", { name: selected.name }) : undefined}
          onClick={onRename}
        >
          {t("rename")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className={touchButtonClass}
          disabled={!selected}
          aria-label={selected ? t("deleteNamed", { name: selected.name }) : undefined}
          onClick={onDelete}
        >
          {t("delete")}
        </Button>
      </div>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground lg:hidden">{label}</p>
      {children}
    </div>
  );
}
