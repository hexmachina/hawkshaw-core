import path from "path";
import { YarnGenerator } from "../yarn-gen";
import { FileUtil } from "./fileUtil";
import { SchemaUtil } from "./schemaUtil";
import { EditContainer } from "../types";
import XLSX from "xlsx";

export enum ExportType {
  None,
  All = ~0,
  Yarn = 1 << 0,
  Csv = 1 << 1,
  Excel = 1 << 2,
}

export class ExportUtil {
  public static EnumerateFlags(value: ExportType): ExportType[] {
    const flags: ExportType[] = [];
    for (const key in ExportType) {
      // Skip numeric keys (TypeScript enums have reverse mapping)
      if (isNaN(Number(key))) {
        const flagValue = ExportType[key as keyof typeof ExportType];
        if (
          typeof flagValue === "number" &&
          flagValue !== 0 &&
          (value & flagValue) === flagValue
        ) {
          flags.push(flagValue);
        }
      }
    }
    return flags;
  }

  public static ParseExportType(arg: string): ExportType {
    let flags = ExportType.None;
    if (arg == undefined || arg.length == 0) {
      return flags;
    }
    const split = arg.split(`,`).map((p) => p.trim());
    return ExportUtil.ParseExportTypeByArray(split);
  }

  public static ParseExportTypeByArray(args: string[]): ExportType {
    let flags = ExportType.None;

    const split = args.map((p) => p.toLowerCase());
    for (const element of split) {
      const name = element.charAt(0).toUpperCase() + element.slice(1);
      const flagValue = ExportType[name as keyof typeof ExportType];
      if (typeof flagValue === "number" && flagValue !== 0) {
        flags |= flagValue;
      }
    }

    return flags;
  }

  public static async ExportByArgument(args: string[], directory: string) {
    const type = ExportUtil.ParseExportTypeByArray(args);
    const flags = ExportUtil.EnumerateFlags(type);
    await ExportUtil.ExportByTypes(flags, directory);
  }

  public static async ExportByTypes(types: ExportType[], directory: string) {
    const edits = await SchemaUtil.GetAllEditContainers();
    const promises: Promise<any>[] = [];
    for (const type of types) {
      switch (type) {
        case ExportType.Csv:
          const dest = path.join(directory, `test.csv`);
          promises.push(ExportUtil.ExportCSV(dest, edits));
          break;
        case ExportType.Yarn:
          promises.push(ExportUtil.ExportYarn(directory, edits));
        case ExportType.Excel:
        default:
          break;
      }
    }
    await Promise.all(promises);
  }

  public static async ExportYarn(directory: string, edits: EditContainer[]) {
    const map: Map<string, EditContainer[]> = new Map();
    for (const element of edits) {
      let array = map.get(element.schema);
      if (!array) {
        array = [];
        map.set(element.schema, array);
      }
      array.push(element);
    }
    const promises: Promise<any>[] = [];
    for (const [key, value] of map) {
      const split = key.split(".");
      const title = `Var_${split[0].charAt(0).toUpperCase()}${split[0].slice(
        1
      )}`;
      const contents = YarnGenerator.ParseEntries(title, value);
      promises.push(
        FileUtil.WriteCleanFile(
          path.join(directory, `${title}.g.yarn`),
          contents.join(`\n`)
        )
      );
    }
    await Promise.all(promises);
  }

  public static async ExportCSV(directory: string, edits: EditContainer[]) {
    const flats = edits.map((e) => ExportUtil.FlattenObject(e));
    const worksheet = XLSX.utils.json_to_sheet(flats);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Entries");
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    await FileUtil.WriteCleanFile(directory, csv);
  }

  // public static FlattenObject(json: any, prefix = ""): Record<string, any> {
  //   return Object.keys(json).reduce((acc: Record<string, any>, key) => {
  //     const prefixedKey = prefix ? `${prefix}.${key}` : key;

  //     if (Array.isArray(json[key])) {
  //       json[key].forEach((item, index) => {
  //         const arrayKey = prefixedKey
  //           ? `${prefixedKey}[${index}]`
  //           : `[${index}]`;
  //         acc[arrayKey] = item;
  //         //Object.assign(acc, ExportUtil.FlattenObject(item, arrayKey));
  //       });
  //     } else if (typeof json[key] === "object") {
  //       Object.assign(acc, ExportUtil.FlattenObject(json[key], prefixedKey));
  //     } else {
  //       acc[prefixedKey] = json[key];
  //     }

  //     return acc;
  //   }, {});
  // }

  // Flatten a nested object (including arrays) into a single-level object
  public static FlattenObject(
    obj: unknown,
    parentKey = "",
    result: Record<string, unknown> = {}
  ): Record<string, unknown> {
    if (obj === null || obj === undefined) {
      result[parentKey] = obj;
      return result;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const key = parentKey ? `${parentKey}[${index}]` : `[${index}]`;
        ExportUtil.FlattenObject(item, key, result);
      });
    } else if (typeof obj === "object") {
      for (const [key, value] of Object.entries(obj)) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;
        ExportUtil.FlattenObject(value, newKey, result);
      }
    } else {
      // Primitive value
      result[parentKey] = obj;
    }
    return result;
  }

  /**
   * Unflattens a flattened object with dot-separated keys into a nested object.
   * @param flatObj - The flattened object
   * @param separator - The key separator (default: '.')
   * @returns The nested object
   */
  // public static UnflattenObject<T = Record<string, any>>(
  //   flatObj: Record<string, any>,
  //   separator: string = "."
  // ): T {
  //   if (typeof flatObj !== "object" || flatObj === null) {
  //     throw new Error("Input must be a non-null object");
  //   }

  //   const result: Record<string, any> = {};

  //   for (const flatKey in flatObj) {
  //     if (!Object.prototype.hasOwnProperty.call(flatObj, flatKey)) continue;

  //     const value = flatObj[flatKey];
  //     const keys = flatKey.split(separator);

  //     let current = result;
  //     keys.forEach((key, index) => {
  //       // If it's the last key, assign the value
  //       if (index === keys.length - 1) {
  //         current[key] = value;
  //       } else {
  //         // Ensure the path exists and is an object
  //         if (typeof current[key] !== "object" || current[key] === null) {
  //           current[key] = {};
  //         }
  //         current = current[key];
  //       }
  //     });
  //   }

  //   return result as T;
  // }

  /**
   * Unflattens a flattened object with dot and bracket notation keys
   * back into a nested object/array structure.
   */
  public static UnflattenObject<T = Record<string, any>>(
    flatObj: Record<string, any>
  ): T {
    const result: any = {};

    for (const flatKey in flatObj) {
      const value = flatObj[flatKey];

      // Split keys into parts: e.g., "user.hobbies[0]" -> ["user", "hobbies", "0"]
      const keys = flatKey
        .replace(/\[(\d+)\]/g, ".$1") // convert [0] to .0
        .split(".");

      let current = result;

      keys.forEach((key, index) => {
        const isLast = index === keys.length - 1;
        const nextKey = keys[index + 1];
        const isArrayIndex = /^\d+$/.test(nextKey || "");

        if (isLast) {
          // Assign value at the last key
          if (/^\d+$/.test(key)) {
            if (!Array.isArray(current)) {
              current = [];
            }
            current[Number(key)] = value;
          } else {
            current[key] = value;
          }
        } else {
          // Create container if missing
          if (/^\d+$/.test(key)) {
            // Ensure current is an array
            if (!Array.isArray(current)) {
              current = [];
            }
            if (!current[Number(key)]) {
              current[Number(key)] = isArrayIndex ? [] : {};
            }
            current = current[Number(key)];
          } else {
            if (!(key in current)) {
              current[key] = isArrayIndex ? [] : {};
            }
            current = current[key];
          }
        }
      });
    }

    return result as T;
  }

  /**
   * Recursively removes properties with null or undefined values from an object.
   * @param obj - The object to clean.
   * @returns A new object without null/undefined properties.
   */
  public static RemoveNullProperties<T extends object>(obj: T): Partial<T> {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    // Create a new object to avoid mutating the original
    const cleanedObj: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        // Recursively clean nested objects/arrays
        cleanedObj[key] =
          typeof value === "object"
            ? ExportUtil.RemoveNullProperties(value as object)
            : value;
      }
    }

    return cleanedObj;
  }

  /**
   * Recursively removes empty objects, empty arrays, null, and undefined values from an object.
   * @param obj The object to clean.
   * @returns A new object without empty values.
   */
  public static RemoveEmptyObjects<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
      // Clean each element and filter out empty arrays/objects
      return obj
        .map((item) => ExportUtil.RemoveEmptyObjects(item))
        .filter((item) => {
          if (item === null || item === undefined) return false;
          if (Array.isArray(item) && item.length === 0) return false;
          if (typeof item === "object" && Object.keys(item).length === 0)
            return false;
          return true;
        }) as unknown as T;
    }

    if (typeof obj === "object") {
      const cleanedObj: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = ExportUtil.RemoveEmptyObjects(value);
        if (
          cleanedValue !== null &&
          cleanedValue !== undefined &&
          !(Array.isArray(cleanedValue) && cleanedValue.length === 0) &&
          !(
            typeof cleanedValue === "object" &&
            Object.keys(cleanedValue).length === 0
          )
        ) {
          cleanedObj[key] = cleanedValue;
        }
      }
      return cleanedObj as T;
    }

    return obj;
  }

  public static LoadCSV(filePath: string): Partial<EditContainer>[] {
    const workbook = XLSX.readFile(filePath, { type: "file", raw: false });
    const sheetName = workbook.SheetNames[0];

    // Get the sheet data
    const sheet = workbook.Sheets[sheetName];

    // Convert sheet to JSON
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const cleanData = ExportUtil.RemoveEmptyObjects(jsonData);
    const unflattenData = cleanData.map((e) =>
      ExportUtil.UnflattenObject(e as Record<string, any>)
    );
    return unflattenData;
  }
}
