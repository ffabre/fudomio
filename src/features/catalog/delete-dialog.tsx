"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/features/catalog/action-result";
import { FormBanner, touchButtonClass } from "@/features/catalog/form-field";

export function DeleteDialog({
  title,
  body,
  onDelete,
  onClose,
}: {
  title: string;
  body: string;
  onDelete: () => Promise<ActionResult>;
  onClose: () => void;
}) {
  const t = useTranslations("products");
  const errors = useTranslations("errors");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
        <AlertDialogHeader className="place-items-start text-start">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <FormBanner message={message} />
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            className={touchButtonClass}
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className={touchButtonClass}
            disabled={pending}
            onClick={() => {
              setMessage(undefined);
              startTransition(async () => {
                const result = await onDelete();
                if (!result.ok) {
                  setMessage(errors(result.error.code));
                  return;
                }
                toast.success(t("deleted"));
                onClose();
              });
            }}
          >
            {t("delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
