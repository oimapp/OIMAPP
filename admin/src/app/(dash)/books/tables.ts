export const tableFor = (bookId: string) =>
  bookId === "constitution" ? "doc_sections"
    : bookId.startsWith("daily") ? "readings" : bookId.startsWith("children") ? "children_lessons" : "lessons";
