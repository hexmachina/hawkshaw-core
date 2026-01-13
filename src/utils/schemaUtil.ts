import * as fs from "fs/promises";
import * as fsSync from "fs";
import path from "path";
import { EditContainer, Entry, HawkshawConfig, Meta, Router } from "../types";
import { AnySchema, Options, SchemaObject, ValidateFunction } from "ajv";
import { FileUtil } from "./fileUtil";
import Ajv from "ajv/dist/2019";

const META_SCHEMA: string = "meta.schema.json";
const EDIT_CONTAINER_LIST_SCHEMA: string = "editContainerList.schema.json";

export class SchemaUtil {
  /**
   * Instantiate an AJV class with certain loaded schemas and options
   * @param schemas a collection of schemas to load.
   * @param options options for AJV class
   * @returns AJV
   */
  public static GetAJV(schemas: Iterable<AnySchema>, options?: Options): Ajv {
    if (!options) {
      options = { schemas: [...schemas], $data: true };
    } else {
      options.schemas = [...schemas];
      options.$data = true;
    }
    const ajv = new Ajv(options);
    require("../ajv-extend/keyword/keyRef")(ajv);
    require("../ajv-extend/keyword/isUnique")(ajv);
    require("ajv-keywords")(ajv);
    return ajv;
  }

  /**
   * Load schemas based on config data.
   * @param options options for AJV class
   * @returns a promise of [Map<string, Router>, Ajv, Map<string, AnySchema>]
   */
  public static async LoadSchemas(
    options?: Options
  ): Promise<[Map<string, Router>, Ajv]> {
    const [routeMap, schemaMap] = await SchemaUtil.GetConfig();
    const map: Map<string, Router> = new Map();
    for (const element of routeMap.values()) {
      map.set(element.schema, element);
    }
    return [map, SchemaUtil.GetAJV(schemaMap.values(), options)];
  }

  public static async CreateEntry(schema: string, key?: string) {
    const [routeMap, schemaMap] = await SchemaUtil.GetConfig();
    let routing: Router | undefined = undefined;
    for (const route of routeMap.values()) {
      if (route.schema == schema) {
        routing = route;
        break;
      }
    }
    if (!routing) {
      return;
    }
    const entry = SchemaUtil.GetEntry(schemaMap, schema, key, routing.prefix);

    const data = JSON.stringify(entry, null, 4); // Pretty-print JSON

    let directory = routing.directory;
    if (!directory) {
      return;
    }
    const filePath = path.join(directory, `${entry.key}.json`);
    await FileUtil.WriteCleanFile(filePath, data);
  }

  public static GetEntry(
    schemaMap: Map<string, AnySchema>,
    schema: string,
    key?: string,
    prefix?: string
  ): Entry {
    const ajv = SchemaUtil.GetAJV(schemaMap.values(), {
      useDefaults: true,
    });

    const def = require("ajv-keywords/dist/definitions/dynamicDefaults");
    def.DEFAULTS.customRandomInt = SchemaUtil.GetCustomRandomInt;
    def.DEFAULTS.keyGen = (args: any) => SchemaUtil.GetKeyGen(args, { prefix });

    const validate = ajv.getSchema(schema);
    if (!validate) {
      throw new Error(`${schema} is not a valid Schema.`);
    }
    const obj = key ? { key } : {};
    return SchemaUtil.CreateFromSchema<Entry>(obj, validate);
  }

  public static async GetConfig(): Promise<
    [Map<string, Router>, Map<string, AnySchema>]
  > {
    const buffer = await fs.readFile(
      path.join(process.cwd(), "hawkshaw.config.json"),
      "utf-8"
    );
    const json = JSON.parse(buffer) as HawkshawConfig;
    return Promise.all([
      FileUtil.ReadFilesByDirectory<Router>(json.routing, [`.json`]),
      FileUtil.ReadFilesByDirectory<AnySchema>(json.schema, [`.json`]),
    ]);
  }

  private static CreateFromSchema<T>(
    partial: Partial<T>,
    validateFn: ValidateFunction
  ): T {
    const data: any = { ...partial }; // clone input
    if (!validateFn(data)) {
      throw new Error(
        "Invalid data: " + JSON.stringify(validateFn.errors, null, 2)
      );
    }
    return data as T;
  }

  public static async GetRouteEntries(
    router: Router
  ): Promise<EditContainer[]> {
    const containers: EditContainer[] = [];
    if (!fsSync.existsSync(router.directory)) {
      return containers;
    }
    const entries = await FileUtil.ReadFilesByDirectory<any>(router.directory, [
      `.json`,
    ]);
    const groups = SchemaUtil.ParseMetaFiles(entries.keys());
    for (const { dataPath, metaPath } of groups) {
      const data = entries.get(dataPath);
      const meta = metaPath ? entries.get(metaPath) : {};
      containers.push({
        data,
        schema: router.schema,
        metaFileName: metaPath ?? "",
        meta,
        fileName: dataPath,
      });
    }
    return containers;
  }

  public static async GetAllEditContainers(): Promise<EditContainer[]> {
    const buffer = await fs.readFile(
      path.join(process.cwd(), "hawkshaw.config.json"),
      "utf-8"
    );
    const json = JSON.parse(buffer) as HawkshawConfig;
    const routeMap = await FileUtil.ReadFilesByDirectory<Router>(json.routing, [
      `.json`,
    ]);
    return SchemaUtil.GetEditContainers(routeMap.values());
  }

  public static ParseMetaFiles(
    paths: Iterable<string>
  ): { dataPath: string; metaPath?: string }[] {
    const regx = /^(.*)\.meta(.*)$/i;
    const map: Map<string, { dataPath: string; metaPath?: string }> = new Map();
    for (const filePath of paths) {
      const file = path.basename(filePath);
      const result = regx.exec(file);
      if (result) {
        const key = result[1];
        let element = map.get(key);
        if (!element) {
          element = { dataPath: "", metaPath: filePath };
          map.set(key, element);
        } else {
          element.metaPath = filePath;
        }
      } else {
        const fileName = path.basename(filePath, path.extname(filePath));
        let element = map.get(fileName);
        if (!element) {
          element = { dataPath: filePath };
          map.set(fileName, element);
        } else {
          element.dataPath = filePath;
        }
      }
    }
    return [...map.values()];
  }

  public static GetKeyGen(
    args?: { length: number },
    options?: { prefix?: string }
  ): any {
    return () =>
      options?.prefix
        ? `${options.prefix}_${SchemaUtil.GenerateRandomString(
            args?.length ?? 8
          )}`
        : SchemaUtil.GenerateRandomString(args?.length ?? 8);
  }

  private static GenerateRandomString(length: number): string {
    // Validate input
    if (!Number.isInteger(length) || length <= 0) {
      throw new Error("Length must be a positive integer.");
    }

    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    let result = "";

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charactersLength);
      result += characters.charAt(randomIndex);
    }

    return result;
  }

  public static GetCustomRandomInt(args?: { base: number; multi: number }) {
    return () => SchemaUtil.CustomRandomInt(args);
  }

  public static CustomRandomInt(args?: {
    base: number;
    multi: number;
  }): number {
    //2147483647
    const base = args?.base ?? 0;
    const multi = args?.multi ?? 100;
    return Math.trunc(base + Math.random() * multi);
  }

  public static async GetEditContainers(
    routes: Iterable<Router>
  ): Promise<EditContainer[]> {
    const promises: Promise<EditContainer[]>[] = [];
    for (const route of routes) {
      promises.push(SchemaUtil.GetRouteEntries(route));
    }

    const containerArrays = await Promise.all(promises);
    const entries: EditContainer[] = [];
    for (const element of containerArrays) {
      entries.push(...element);
    }
    return entries;
  }

  public static async Validate() {
    const [routeMap, schemaMap] = await SchemaUtil.GetConfig();

    const entries = await SchemaUtil.GetEditContainers(routeMap.values());
    const ajv = SchemaUtil.GetAJV(schemaMap.values());

    const validate = ajv.getSchema(EDIT_CONTAINER_LIST_SCHEMA);
    if (!validate) {
      return;
    }
    const result = validate(entries);
    if (!result) {
      console.error(validate.errors);
    }
  }

  public static async CreateFromRecords(records: Record<string, any>[]) {
    const [routeMap, ajv] = await SchemaUtil.LoadSchemas({
      useDefaults: true,
    });
    const def = require("ajv-keywords/dist/definitions/dynamicDefaults");
    def.DEFAULTS.customRandomInt = SchemaUtil.GetCustomRandomInt;
    const options: { prefix?: string } = {};
    def.DEFAULTS.keyGen = (args: any) => SchemaUtil.GetKeyGen(args, options);
    const promises: Promise<any>[] = [];
    const keyMap: Map<string, string> = new Map();
    for (const record of records) {
      keyMap.clear();
      for (const [key, _] of Object.entries(record)) {
        keyMap.set(key.toLowerCase(), key);
      }

      const schemaKey = keyMap.get("schema");
      if (!schemaKey) {
        continue;
      }
      const schema = record[schemaKey];
      const validate = ajv.getSchema(schema);
      if (!validate) {
        throw new Error(`${schema} is not a valid Schema.`);
      }
      const routing = routeMap.get(schema);
      if (!routing || !routing.directory) {
        continue;
      }
      const prefix = (validate.schema as SchemaObject)["$comment"];

      //const regx = /\b(the|a|an)\b.?/gi;
      const titleKey = keyMap.get("title");
      const metaPartial: Partial<Meta> = {};
      let fileName = undefined;
      if (titleKey && record[titleKey].length > 0) {
        const title = record[titleKey];
        fileName = SchemaUtil.GetKeyFilename(title, prefix);

        metaPartial.title = title;
      } else {
        options.prefix = prefix;
      }
      const descKey = keyMap.get("description");
      if (descKey && record[descKey].length > 0) {
        metaPartial.description = record[descKey];
      }
      const dataPartial: Partial<Entry> = fileName ? { key: fileName } : {};
      const entry = SchemaUtil.CreateFromSchema<Entry>(dataPartial, validate);
      let directory = routing.directory;
      const dataFilePath = path.join(directory, `${entry.key}.json`);

      const metaValidate = ajv.getSchema(META_SCHEMA);
      if (!metaValidate) {
        continue;
      }
      const metaFilePath = path.join(directory, `${entry.key}.meta.json`);
      const meta = SchemaUtil.CreateFromSchema<Meta>(metaPartial, metaValidate);
      const edit: EditContainer = {
        data: entry,
        meta,
        fileName: dataFilePath,
        metaFileName: metaFilePath,
        schema,
      };
      const promise = SchemaUtil.WriteEditContainer(edit, false);
      if (promise) {
        promises.push(promise);
      }
    }
    await Promise.all(promises);
  }

  public static GetKeyFilename(title: string, prefix?: string): string {
    const regx = /\b(the|a|an)\b.?/gi;
    let fileName = title
      .toLowerCase()
      .replace(regx, "")
      .replace(FileUtil.FILENAME_REGEX, "_")
      .replace(/^\.|(?:[.'])/g, "");
    if (prefix) {
      fileName = `${prefix}_${fileName}`;
    }
    return fileName.substring(0, 32);
  }

  public static async CreateEntryAndMeta(
    routeMap: Map<string, Router>,
    ajv: Ajv,
    schema: string,
    title: string,
    description?: string
  ): Promise<string[]> {
    const routing = routeMap.get(schema);
    if (!routing || !routing.directory) {
      throw new Error(`Routing for schema ${schema} not found.`);
    }
    const [entry, meta] = SchemaUtil.GetEntryAndMeta(
      ajv,
      schema,
      title,
      description
    );
    let directory = routing.directory;
    const dataFilePath = path.join(directory, `${entry.key}.json`);
    const metaFilePath = path.join(directory, `${entry.key}.meta.json`);

    const edit: EditContainer = {
      data: entry,
      meta,
      fileName: dataFilePath,
      metaFileName: metaFilePath,
      schema,
    };
    await SchemaUtil.WriteEditContainer(edit, false);
    return [dataFilePath, metaFilePath];
  }

  public static GetEntryAndMeta(
    ajv: Ajv,
    schema: string,
    title: string,
    description?: string
  ): [Entry, Meta] {
    const validate = ajv.getSchema(schema);
    if (!validate) {
      throw new Error(`${schema} is not a valid Schema.`);
    }
    const prefix = (validate.schema as SchemaObject)["$comment"];
    const fileName = SchemaUtil.GetKeyFilename(title, prefix);

    const metaPartial: Partial<Meta> = {};
    metaPartial.title = title;

    if (description) {
      metaPartial.description = description;
    }

    const dataPartial: Partial<Entry> = fileName ? { key: fileName } : {};
    const entry = SchemaUtil.CreateFromSchema<Entry>(dataPartial, validate);

    const metaValidate = ajv.getSchema(META_SCHEMA);
    if (!metaValidate) {
      throw new Error("meta schema not found.");
    }

    const meta = SchemaUtil.CreateFromSchema<Meta>(metaPartial, metaValidate);
    return [entry, meta];
  }

  public static WriteEditContainer(
    edit: EditContainer,
    canReplace: boolean = false
  ): Promise<any[]> | undefined {
    const promises: Promise<any>[] = [];
    const data = FileUtil.WriteJSON(edit.fileName, edit.data, canReplace);
    if (data) {
      promises.push(data);
    }
    const meta = FileUtil.WriteJSON(edit.metaFileName, edit.meta, canReplace);
    if (meta) {
      promises.push(meta);
    }
    if (promises.length == 0) {
      return undefined;
    }
    return Promise.all(promises);
  }

  public static SchemaOptions(
    routeMap: Map<string, Router>,
    ajv: Ajv
  ): { name: string; value: string }[] {
    const array: { name: string; value: string }[] = [];
    for (const element of routeMap.values()) {
      const func = ajv.getSchema(element.schema);
      const schema = func?.schema as SchemaObject;
      if (!schema) {
        continue;
      }
      const name = schema.title ?? schema.$id;
      array.push({ name, value: schema.$id! });
    }
    return array;
  }

  public static CleanEditContainers(
    ajv: Ajv,
    partials: Partial<EditContainer>[],
    options: { prefix?: string },
    routeMap: Map<string, Router>
  ): EditContainer[] {
    const metaValidate = ajv.getSchema(META_SCHEMA);
    if (!metaValidate) {
      throw new Error("meta schema not found.");
    }

    const edits: EditContainer[] = [];
    for (const element of partials) {
      if (!element.schema) {
        continue;
      }
      let validate = ajv.getSchema(element.schema);
      if (!validate) {
        continue;
      }
      const prefix = (validate.schema as SchemaObject)["$comment"];
      options.prefix = prefix;
      let pEntry = element.data as Partial<Entry>;
      if (element.meta?.title) {
        if (!pEntry) {
          pEntry = {};
        }
        if (!pEntry.key) {
          pEntry.key = SchemaUtil.GetKeyFilename(element.meta.title, prefix);
        }
      }
      (pEntry as any).test = "test";
      const data = SchemaUtil.CreateFromSchema<Entry>(pEntry, validate);
      const meta = SchemaUtil.CreateFromSchema<Meta>(
        element.meta ?? {},
        metaValidate
      );
      let fileName = element.fileName;
      if (!fileName) {
        fileName = path.join(
          routeMap.get(element.schema)?.directory!,
          `${data.key}.json`
        );
      }
      let metaFileName = element.metaFileName;
      if (!metaFileName) {
        metaFileName = path.join(
          routeMap.get(element.schema)?.directory!,
          `${data.key}.meta.json`
        );
      }
      edits.push({
        data,
        fileName,
        meta,
        metaFileName,
        schema: element.schema,
      });
    }
    const validate = ajv.getSchema(EDIT_CONTAINER_LIST_SCHEMA);
    if (!validate) {
      throw new Error("schema not found");
    }
    const result = validate(edits);
    if (!result) {
      console.error(validate.errors);
    }
    return edits;
  }

  public static CompareEditContainers(
    source: EditContainer[],
    target: EditContainer[]
  ): EditContainer[] {
    const diff: EditContainer[] = [];
    const map: Map<string, EditContainer> = new Map(
      source.map((e) => [e.fileName, e])
    );
    for (const element of target) {
      const found = map.get(element.fileName);
      if (!found) {
        diff.push(element);
        continue;
      }
      if (JSON.stringify(element.data) !== JSON.stringify(found.data)) {
        diff.push(element);
        continue;
      }
      if (JSON.stringify(element.meta) !== JSON.stringify(found.meta)) {
        diff.push(element);
        continue;
      }
    }
    return diff;
  }
}
