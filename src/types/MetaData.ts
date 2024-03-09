/**
 * ex.
 *  @directory  /example1/example2
 *  @ownerId    session.user.username
 */
export type MetaData = {
  directory: string;
  fileName: string;
  ownerId: string;
  key: string;
  uploadTime: number;
  type: FileType;
  size: number;
  isFavorite:boolean;
};

export const fileTypes = {
  file: "file",
  folder: "folder",
  image: "image",
  video: "video",
} as const;

export type FileType = (typeof fileTypes)[keyof typeof fileTypes];
