import { EditContainer } from "../types";
import { YarnNodeSimple } from "./types";

export class YarnGenerator {
  public static YarnWrapper(nodes: YarnNodeSimple[]): string[] {
    const wrapped: string[] = [];
    for (const element of nodes) {
      wrapped.push(
        ...YarnGenerator.NodeParser(
          element.title,
          element.contents,
          element.headers,
        ),
      );
    }
    return [...YarnGenerator.YarnHeader(), ...wrapped];
  }
  public static NodeParser(
    title: string,
    contents: string[],
    headers?: Record<string, string>,
  ): string[] {
    if (!title || title.length == 0) {
      throw Error("Invalid args");
    }
    const head: string[] = [];
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        head.push(`${key}: ${value}`);
      }
    }
    return [`title: ${title}`, ...head, `---`, ...contents, `===`, ``];
  }

  public static YarnHeader(): string[] {
    return [
      YarnGenerator.CommentWrapper(`This file was automatically generated.`),
      YarnGenerator.CommentWrapper(`DO NOT MODIFY IT BY HAND.`),
      ``,
    ];
  }
  public static BooleanVariableWrapper(variableName: string): string {
    return `<<declare $${variableName} = false>>`;
  }
  public static CommentWrapper(comment: string): string {
    if (comment.length == 0) {
      return comment;
    }
    return `// ${comment}`;
  }

  public static ParseEntries(
    title: string,
    containers: EditContainer[],
  ): string[] {
    const contents: string[] = [];
    const regex = /\r\n|\r|\n/g;
    for (const element of containers) {
      if (element.meta) {
        if (element.meta.title) {
          contents.push(YarnGenerator.CommentWrapper(element.meta?.title));
        }
        if (element.meta.description) {
          const split = element.meta.description.split(regex);
          for (const clip of split) {
            contents.push(YarnGenerator.CommentWrapper(clip));
          }
        }
      }
      contents.push(YarnGenerator.BooleanVariableWrapper(element.data.key));
    }
    return YarnGenerator.YarnWrapper([{ title, contents }]);
  }

  public static ClueDescriptions(containers: EditContainer[]): string[] {
    const clueSchemas: string[] = [
      "clue.schema.json",
      "document.schema.json",
      `weapon.schema.json`,
    ];
    const descNodes: {
      title: string;
      contents: string[];
      headers?: Record<string, string>;
    }[] = [];
    for (const edit of containers) {
      if (!clueSchemas.includes(edit.schema)) {
        continue;
      }
      descNodes.push({
        title: `${edit.data.key}_desc`,
        contents: [`Narrator: ${edit.meta?.description}`],
      });
    }
    return YarnGenerator.YarnWrapper(descNodes);
  }

  public static ClueOptions(containers: EditContainer[]): string[] {
    const clueSchemas: string[] = [
      "clue.schema.json",
      "document.schema.json",
      "weapon.schema.json",
    ];

    const contents: string[] = [];
    const title = `Clue_Q`;
    for (const edit of containers) {
      if (!clueSchemas.includes(edit.schema)) {
        continue;
      }
      contents.push(`-> ${edit.meta?.title} <<if $${edit.data.key}>>`);
      contents.push(`    <<detour ${edit.data.key}_A>>`);
    }
    contents.push(`-> Back...`);
    contents.push(`    <<jump Investigation_Q>>`);
    contents.push(`<<jump ${title}>>`);
    return YarnGenerator.YarnWrapper([{ title, contents }]);
  }

  public static ClueJournalOptions(containers: EditContainer[]): string[] {
    const clueSchemas: string[] = [
      "clue.schema.json",
      "document.schema.json",
      "weapon.schema.json",
    ];

    const contents: string[] = [];
    const title = `Journal_Clue`;
    for (const edit of containers) {
      if (!clueSchemas.includes(edit.schema)) {
        continue;
      }
      contents.push(`-> ${edit.meta?.title} <<if $${edit.data.key}>>`);
      contents.push(`    <<detour ${edit.data.key}_desc>>`);
    }
    contents.push(`-> Back...`);
    contents.push(`    <<jump Journal>>`);
    contents.push(`<<jump ${title}>>`);
    return YarnGenerator.YarnWrapper([{ title, contents }]);
  }

  public static ModifyClueResponses(
    edits: EditContainer[],
    fileData?: Map<string, string>,
  ): Map<string, string[]> {
    const target = YarnGenerator.EntryClueResponses(edits);
    if (fileData) {
      const source = YarnGenerator.ParseFiles(fileData);
      return YarnGenerator.ConsolidateYarn(source, target);
    }
    return YarnGenerator.NodesToLines(target);
  }

  public static EntryClueResponses(
    containers: EditContainer[],
  ): Map<string, Map<string, YarnNodeSimple>> {
    const suspectSchema = "character.schema.json";
    const clueSchemas: string[] = [
      "clue.schema.json",
      "document.schema.json",
      "weapon.schema.json",
    ];
    const sus: EditContainer[] = [];
    const clues: EditContainer[] = [];
    for (const edit of containers) {
      if (edit.schema == suspectSchema) {
        sus.push(edit);
        continue;
      }

      if (clueSchemas.includes(edit.schema)) {
        clues.push(edit);
        continue;
      }
    }
    const contexts: { headers: Record<string, string>; comments: string[] }[] =
      [];
    for (const element of sus) {
      const rec: Record<string, string> = {};
      if (!element.meta?.title) {
        continue;
      }
      const target = YarnGenerator.ToCamelCase(element.meta?.title);
      rec["subtitle"] = target;
      rec["when"] = `$conversant == .${target}`;
      contexts.push({
        headers: rec,
        comments: [`// ${element.meta?.title}: PLACEHOLDER`, `<<detour IDK>>`],
      });
    }
    const files: Map<string, Map<string, YarnNodeSimple>> = new Map();
    for (const element of clues) {
      const nodes: Map<string, YarnNodeSimple> = new Map();
      const question = `${element.data.key}_Q`;
      nodes.set(question, {
        title: question,
        contents: [`Player: PH Tell me about ${element.meta?.title}.`],
      });
      const title = `${element.data.key}_A`;
      for (const context of contexts) {
        let key = title;
        if (context.headers && context.headers["subtitle"]) {
          key = `${key}.${context.headers["subtitle"]}`;
        }

        nodes.set(key, {
          title,
          headers: context.headers,
          contents: [`<<detour ${question}>>`, ...context.comments],
        });
      }
      files.set(title, nodes);
    }
    return files;
  }

  public static ConsolidateYarn(
    source: Map<string, Map<string, YarnNodeSimple>>,
    target: Map<string, Map<string, YarnNodeSimple>>,
  ): Map<string, string[]> {
    for (const [key, value] of target) {
      const found = source.get(key);
      if (!found) {
        source.set(key, value);
        continue;
      }
      YarnGenerator.MergeNodesToSource(found, value);
    }
    return YarnGenerator.NodesToLines(source);
  }

  public static NodesToLines(
    source: Map<string, Map<string, YarnNodeSimple>>,
  ): Map<string, string[]> {
    const map: Map<string, string[]> = new Map();
    for (const [key, value] of source) {
      map.set(key, YarnGenerator.YarnWrapper([...value.values()]));
    }
    return map;
  }

  public static MergeNodesToSource(
    source: Map<string, YarnNodeSimple>,
    target: Map<string, YarnNodeSimple>,
  ) {
    for (const [key, value] of target) {
      const found = source.get(key);
      if (!found) {
        source.set(key, value);
        continue;
      }
      if (!value.headers) {
        continue;
      }
      if (!found.headers) {
        found.headers = { ...value.headers };
        continue;
      }
      const foundHeaders = Object.entries(found.headers);
      found.headers = { ...value.headers };
      for (const [tag, data] of foundHeaders) {
        found.headers[tag] = data;
      }
    }
  }

  public static ToCamelCase(str: string): string {
    if (typeof str !== "string") {
      throw new TypeError("Input must be a string");
    }

    return (
      str
        .trim() // Remove leading/trailing spaces
        .toLowerCase() // Start with all lowercase
        .replace(/[^a-z0-9\s]+/g, "") // Remove non-alphanumeric chars
        //.replace(/\s+(\w)/g, (_, letter) => letter.toUpperCase()); // Uppercase after spaces
        .replace(/(?:^|\s+)(\w)/g, (_, letter) => letter.toUpperCase())
    ); // Uppercase after spaces
  }

  public static ParseFiles(
    files: Map<string, string>,
  ): Map<string, Map<string, YarnNodeSimple>> {
    const nodes: Map<string, Map<string, YarnNodeSimple>> = new Map();
    for (const [key, blob] of files) {
      const map = YarnGenerator.ParseFile(blob);
      if (!map) {
        continue;
      }
      nodes.set(key, map);
    }
    return nodes;
  }

  public static ParseFile(
    blob: string,
  ): Map<string, YarnNodeSimple> | undefined {
    const regex = /title:\s*(.*)\n([\s\S]*?)\n*?---\n([\s\S]*?)\n===\n*?/g;

    const match = blob.matchAll(regex);
    if (!match) {
      return undefined;
    }
    const nodes: Map<string, YarnNodeSimple> = new Map();
    for (const m of match) {
      const group = m;
      if (!group) {
        continue;
      }
      let headers: Record<string, string> | undefined = undefined;
      const contents: string[] = [];
      let key = group[1];
      const title = group[1];
      const headerBlob = group[2];
      if (headerBlob && headerBlob.length > 0) {
        const split = headerBlob.split(`\n`);
        for (const element of split) {
          const tags = element.split(":");
          if (tags.length < 2) {
            continue;
          }
          if (!headers) {
            headers = {};
          }
          headers[tags[0].trim()] = tags[1].trim();
        }
      }
      if (headers && headers["subtitle"]) {
        key = `${key}.${headers["subtitle"]}`;
      }
      const contentBlob = group[3];
      contents.push(...contentBlob.split("\n"));
      nodes.set(key, { title, headers, contents });
    }
    return nodes;
  }
}
