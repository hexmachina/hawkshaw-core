import * as fs from "fs/promises";
import * as fsSync from "fs";
import path from "path";

const filenameRegex = /^\.|(?:[\\/:*?"<>|\s])/g;
export class FileUtil {
  public static get FILENAME_REGEX(): RegExp {
    return filenameRegex;
  }
  public static async ReadFilesByDirectory<T>(
    dirPath: string,
    extensions: string[]
  ): Promise<Map<string, T>> {
    const files = await FileUtil.ReadAllFilePaths(dirPath, extensions);
    const promises: Promise<string>[] = [];
    for (const element of files) {
      promises.push(fs.readFile(element, `utf-8`));
    }
    const routeBuffers = await Promise.all(promises);
    const data: Map<string, T> = new Map();
    for (let i = 0; i < routeBuffers.length; i++) {
      const element = routeBuffers[i];
      if (!element || element.length == 0) {
        continue;
      }
      data.set(files[i], JSON.parse(element) as T);
    }

    return data;
  }

  public static async ReadAllFilePaths(
    dirPath: string,
    extensions: string[]
  ): Promise<string[]> {
    let filePaths: string[] = [];

    const files = await fs.readdir(dirPath, {
      recursive: true,
      withFileTypes: true,
    });

    for (const file of files) {
      if (file.isFile() && extensions.includes(path.extname(file.name))) {
        filePaths.push(path.join(file.parentPath, file.name));
      }
    }
    return filePaths;
  }

  public static WriteJSON(
    filePath?: string,
    obj?: any,
    canReplace: boolean = false
  ): Promise<string> | undefined {
    if (!obj || !filePath || filePath.length == 0) {
      return undefined;
    }
    if (path.extname(filePath) !== `.json`) {
      return undefined;
    }
    if (fsSync.existsSync(filePath) && !canReplace) {
      return undefined;
    }
    const jsonBlob = JSON.stringify(obj, null, 4); // Pretty-print JSON
    return FileUtil.WriteCleanFile(filePath, jsonBlob);
  }

  public static async WriteCleanFile(
    filePath: string,
    data: string
  ): Promise<string> {
    const filenameRegex = /^\.|(?:[\\/:*?"<>|\s])/g;
    const directory = path.dirname(filePath);
    if (!fsSync.existsSync(directory)) {
      fsSync.mkdirSync(directory, { recursive: true });
    }
    const ext = path.extname(filePath);
    let fileName = path.basename(filePath, ext);
    fileName = fileName.replace(filenameRegex, "_");
    const newFileName = path.join(directory, `${fileName}${ext}`);
    //Write JSON string to a file
    await fs.writeFile(newFileName, data);
    return newFileName;
  }
}
