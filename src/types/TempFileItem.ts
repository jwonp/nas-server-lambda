import { MetaData } from "./MetaData";

export type TempFileItem = Omit<MetaData, "isFavorite" | "uploadTime"> & {
  originFile?: File;
  isSaved?: boolean;
};
