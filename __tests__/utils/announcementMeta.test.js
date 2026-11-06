import { buildAnnouncementMeta } from "../../utils/announcementMeta";

describe("buildAnnouncementMeta", () => {
  it("con remitente: organización · persona · fecha", () => {
    expect(
      buildAnnouncementMeta(
        { sender_name: "UDM AFyC de Valencia. La Fe", created_by_name: "Marta Ruiz" },
        "12 nov"
      )
    ).toBe("UDM AFyC de Valencia. La Fe · Marta Ruiz · 12 nov");
  });

  it("sin remitente (comunicado antiguo o vista sin la columna): queda como antes", () => {
    expect(
      buildAnnouncementMeta({ sender_name: null, created_by_name: "Marta Ruiz" }, "12 nov")
    ).toBe("Marta Ruiz · 12 nov");
    expect(buildAnnouncementMeta({ created_by_name: "Marta Ruiz" }, "12 nov")).toBe(
      "Marta Ruiz · 12 nov"
    );
  });

  it("sin persona: organización · fecha", () => {
    expect(
      buildAnnouncementMeta({ sender_name: "Hospital La Fe", created_by_name: "  " }, "12 nov")
    ).toBe("Hospital La Fe · 12 nov");
  });

  it("sin nada: cadena vacía, para no pintar la línea", () => {
    expect(buildAnnouncementMeta({}, null)).toBe("");
  });
});
