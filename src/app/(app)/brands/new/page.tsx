import type { Metadata } from "next";
import { ActionForm } from "@/components/ui/action-form";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { createBrandAction } from "@/server/actions/brands";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "New brand" };

export default async function NewBrandPage() {
  await requireContext("content.edit");
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Brands", href: "/brands" }, { label: "New" }]} title="New brand" description="Brands created manually start at the Idea stage and go through research like any other." />
      <Card className="max-w-2xl">
        <CardBody>
          <ActionForm action={createBrandAction} submitLabel="Create brand">
            <Field label="Working title" htmlFor="working_title">
              <Input id="working_title" name="working_title" required minLength={2} maxLength={200} />
            </Field>
            <Field label="Niche" htmlFor="niche">
              <Input id="niche" name="niche" required minLength={2} maxLength={200} placeholder="e.g. Balloon artists" />
            </Field>
            <Field label="Sub-niche" htmlFor="sub_niche">
              <Input id="sub_niche" name="sub_niche" maxLength={200} />
            </Field>
            <Field label="Audience" htmlFor="audience">
              <Textarea id="audience" name="audience" maxLength={1000} rows={2} />
            </Field>
            <Field label="Opportunity thesis" htmlFor="opportunity_thesis">
              <Textarea id="opportunity_thesis" name="opportunity_thesis" maxLength={4000} rows={3} />
            </Field>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
