export function subjectHref(subjectType: string, subjectId: string, brandId: string | null, payload: Record<string, unknown>): string | null {
  switch (subjectType) {
    case "opportunity":
      return `/opportunities/${subjectId}`;
    case "design":
      return `/design-studio/${subjectId}`;
    case "compliance_review":
      return typeof payload.design_id === "string" ? `/design-studio/${payload.design_id}` : null;
    case "brand":
      return `/brands/${subjectId}`;
    case "brand_identity":
      return brandId ? `/brands/${brandId}/identity` : null;
    case "brand_name":
      return brandId ? `/brands/${brandId}/names` : null;
    case "store":
      return `/stores/${subjectId}`;
    case "campaign":
      return `/growth/${subjectId}`;
    case "provider_credentials":
      return "/settings/providers";
    default:
      return null;
  }
}
