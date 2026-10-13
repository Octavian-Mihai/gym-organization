let counter = 0;
export const newId = (prefix = "id"): string => {
  counter += 1;
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}${counter.toString(36)}`;
};
