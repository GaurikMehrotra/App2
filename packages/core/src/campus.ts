export type CampusPreview = {
  campusPostId: string;
  authorId: string;
  title: string;
  excerpt: string;
  sourceURL: string;
};
export interface CampusBridge {
  getShareablePreview(postId: string): Promise<CampusPreview>;
  publishPreview(preview: CampusPreview, publicPostId: string): Promise<void>;
  publicTrends(region: string, language: string): Promise<{ tag: string }[]>;
}
// Implement this adapter in the real campus server, validating source visibility,
// current ownership and explicit public-sharing consent. Do not trust client-supplied previews.
