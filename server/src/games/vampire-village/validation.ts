import type { GameMode, RoleCounts, RoleValidation } from "./VampireVillageTypes.js";

export function validateRoleDistribution(playerCount: number, roles: RoleCounts, mode: GameMode): RoleValidation {
  const values = [roles.vampires, roles.villagers, roles.doctors];
  const selectedTotal = values.reduce((sum, value) => sum + value, 0);
  const balanced = roles.vampires < roles.villagers + roles.doctors;
  const errors: RoleValidation["errors"] = [];
  const warnings: string[] = [];

  if (!values.every(Number.isInteger)) {
    errors.push({ code: "ROLE_COUNT_NOT_INTEGER", message: "Rol sayıları tam sayı olmalıdır." });
  }
  if (values.some((value) => value < 0)) {
    errors.push({ code: "NEGATIVE_ROLE_COUNT", message: "Rol sayıları negatif olamaz." });
  }
  if (selectedTotal !== playerCount) {
    errors.push({ code: "INVALID_ROLE_TOTAL", message: "Rol sayısı oyuncu sayısına eşit olmalıdır." });
  }
  if (roles.vampires < 1) {
    errors.push({ code: "VAMPIRE_REQUIRED", message: "En az 1 Vampir olmalıdır." });
  }
  if (roles.villagers + roles.doctors < 1) {
    errors.push({ code: "NON_VAMPIRE_REQUIRED", message: "En az 1 Vampir olmayan rol olmalıdır." });
  }
  if (!balanced) {
    if (mode === "BALANCED") {
      errors.push({
        code: "UNBALANCED_ROLES",
        message: "Dengeli modda Vampir sayısı diğer rollerin toplamından az olmalıdır."
      });
    } else {
      warnings.push("Bu rol dağılımı dengeli değildir. Oyun çok kısa sürebilir.");
    }
  }

  return {
    valid: errors.length === 0,
    balanced,
    selectedTotal,
    difference: playerCount - selectedTotal,
    errors,
    warnings
  };
}
