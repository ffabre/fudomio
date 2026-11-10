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
import type { ActionError, ActionResult } from "@/features/catalog/action-result";
import {
  fieldAria,
  FormBanner,
  FormField,
  touchButtonClass,
} from "@/features/catalog/form-field";
import type { CatalogCategory } from "@/features/catalog/types";

type CategoryField =
  | { mode: "fixed"; id: number; name: string }
  | { mode: "select"; categories: CatalogCategory[] };

export function NameDialog({
  title,
  initialName,
  categoryField,
  onSubmit,
  onClose,
}: {
  title: string;
  initialName: string;
  categoryField?: CategoryField;
  onSubmit: (value: { name: string; categoryId?: number }) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const t = useTranslations("products");
  const errors = useTranslations("errors");
  const [name, setName] = useState(initialName);
  const [categoryId, setCategoryId] = useState(
    categoryField?.mode === "fixed" ? String(categoryField.id) : "",
  );
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();

  function message(field: ActionError["field"]) {
    if (!error || error.field !== field) return undefined;
    return errors(error.code);
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextCategoryId =
      categoryField?.mode === "fixed"
        ? categoryField.id
        : categoryField?.mode === "select"
          ? Number(categoryId)
          : undefined;

    startTransition(async () => {
      const result = await onSubmit({
        name,
        categoryId: nextCategoryId,
      });
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
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {categoryField?.mode === "fixed" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{t("category")}</p>
              <p className="text-base break-words">{categoryField.name}</p>
              {message("category") ? (
                <p role="alert" className="text-sm text-destructive">
                  {message("category")}
                </p>
              ) : null}
            </div>
          ) : null}
          {categoryField?.mode === "select" ? (
            <FormField
              id="catalog-category"
              label={t("category")}
              error={message("category")}
            >
              <NativeSelect
                {...fieldAria("catalog-category", message("category"))}
                value={categoryId}
                disabled={pending}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setError(null);
                }}
              >
                <option value="">{t("chooseCategory")}</option>
                {categoryField.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : null}
          <FormField id="catalog-name" label={t("name")} error={message("name")}>
            <Input
              {...fieldAria("catalog-name", message("name"))}
              value={name}
              disabled={pending}
              autoFocus
              className="h-11 min-h-11 text-base"
              onFocus={
                initialName
                  ? (event) => event.currentTarget.select()
                  : undefined
              }
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
            />
          </FormField>
          <FormBanner message={error && !error.field ? errors(error.code) : undefined} />
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
