import { describe, expect, it } from "vitest";
import { getPublicationRequirements, type MockAccount } from "./mock-auth-context";

function accountWith(overrides?: {
  name?: string;
  webAddress?: string;
  organizationTypeConfirmed?: boolean;
  firstName?: string;
  lastName?: string;
}) {
  return {
    firstName: overrides?.firstName ?? "",
    lastName: overrides?.lastName ?? "",
    workspace: {
      name: overrides?.name ?? "Мой ресторан 4821",
      webAddress: overrides?.webAddress ?? "1786422004850.tsqr.me",
      organizationType: "restaurant",
      organizationTypeConfirmed: overrides?.organizationTypeConfirmed ?? false,
    },
  } as MockAccount;
}

describe("publication requirements", () => {
  it("accepts generated registration values and the default organization type", () => {
    expect(getPublicationRequirements(accountWith()).map(({ id }) => id)).toEqual([
      "first-name",
      "last-name",
    ]);
  });

  it("does not require a separate confirmation of the preselected restaurant type", () => {
    const requirements = getPublicationRequirements(accountWith({
      name: "RAUDA",
      webAddress: "rauda.tsqr.me",
      firstName: "Алия",
      lastName: "Серикова",
    }));

    expect(requirements).toEqual([]);
  });

  it("allows publication only when all five fields are valid", () => {
    expect(getPublicationRequirements(accountWith({
      name: "RAUDA",
      webAddress: "rauda.tsqr.me",
      organizationTypeConfirmed: true,
      firstName: "Алия",
      lastName: "Серикова",
    }))).toEqual([]);
  });
});
