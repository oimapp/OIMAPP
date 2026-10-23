export const tableFor = (bookId: string) =>
  bookId.startsWith("daily") ? "readings" : bookId.startsWith("children") ? "children_lessons" : "lessons";
