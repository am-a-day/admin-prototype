import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MockAuthProvider, useMockAuth } from "@/contexts/mock-auth-context";

function WorkspaceLanguagesProbe() {
  const { account } = useMockAuth();
  return <div>{account?.workspace.languages.map(({ code }) => code).join(",")}</div>;
}

describe("MockAuthProvider language migrations", () => {
  beforeEach(() => window.localStorage.clear());

  it("adds the five default translation languages to legacy workspaces", () => {
    window.localStorage.setItem(
      "tasko.mockAuth.v1",
      JSON.stringify({
        accounts: {
          legacy: {
            id: "legacy",
            contact: "legacy@example.com",
            displayName: "Legacy owner",
            role: "Владелец",
            catalogSnapshot: {},
            workspace: {
              name: "Legacy restaurant",
              status: "published",
              firstEntry: false,
              contactVerified: true,
              setupCompleted: true,
              primaryLanguage: "ru",
              languages: [{ code: "ru", status: "ready", visible: true }],
            },
          },
        },
        contactIndex: { "legacy@example.com": "legacy" },
      }),
    );
    window.localStorage.setItem("tasko.mockAuth.session.v1", "legacy");

    render(
      <MockAuthProvider>
        <WorkspaceLanguagesProbe />
      </MockAuthProvider>,
    );

    expect(screen.getByText("ru,kk,en,zh,fr,es")).toBeInTheDocument();
  });
});
