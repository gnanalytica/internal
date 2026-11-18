import { describe, expect, it } from "vitest";

import { canSeeDepartment } from "@/lib/departments";
import { prospectHref, salesProjectId } from "./access";

const val = (enabledDepartments: string[] | null) => ({ id: "p-val", key: "VAL", enabledDepartments });

describe("salesProjectId", () => {
  it("finds Valytica when Sales is on and the role may see Sales", () => {
    expect(salesProjectId([{ id: "p-x", key: "RLY", enabledDepartments: ["sales"] }, val(["product", "sales"])], "admin")).toBe("p-val");
  });

  it("follows the department rule for members, as the Sales page does", () => {
    expect(salesProjectId([val(["sales"])], "member")).toBe(canSeeDepartment("sales", "member") ? "p-val" : null);
  });

  it("shows nothing when Sales is off for the product or there is no Valytica", () => {
    expect(salesProjectId([val(["product"])], "admin")).toBeNull();
    expect(salesProjectId([val(null)], "admin")).toBeNull();
    expect(salesProjectId([{ id: "p-x", key: "RLY", enabledDepartments: ["sales"] }], "admin")).toBeNull();
  });
});

describe("prospectHref", () => {
  it("encodes the record id, slashes and all", () => {
    expect(prospectHref("p-val", { kind: "valuer", id: "IBBI/RV/02/2018/10374" })).toBe("/projects/p-val/sales?rec=valuer%3AIBBI%2FRV%2F02%2F2018%2F10374");
  });
});
