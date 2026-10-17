export type Section = { id: string; title: string; anchor: string }
export type Page = { id: string; url: string; title: string; sections: Section[]; md?: string }
export type SiteMap = { root: string; frameable: boolean; pages: Page[] }
export type Intent = {
  action: "navigate" | "explain" | "answer" | "read"
  pageId?: string
  anchor?: string
  text: string
}
