export function arraysEqual(arr1, arr2, compareFunction) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (!compareFunction(arr1[i], arr2[i])) return false;
  }
  return true;
}
