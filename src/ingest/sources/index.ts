import type { BoardSource, JobSource } from "../types";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { ashby } from "./ashby";

/**
 * The source registry. Adding an ATS is a file here plus a value on the
 * ats_source enum — nothing in the resolver or persist layer changes.
 */
export const SOURCES: Record<BoardSource, JobSource> = {
  greenhouse,
  lever,
  ashby,
};

export { greenhouse, lever, ashby };
