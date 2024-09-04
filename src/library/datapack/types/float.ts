import { cached } from "../lib/cached";
import num from "./num";

export default cached(
  (b: 32 | 64 = 64) => (
    num(window[`Float${b}Array`], 'Float' + b)
  )
);