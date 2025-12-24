import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

interface GameBananaFile {
  _idRow: number;
  _sFile: string;
  _nFilesize: number;
  _sMd5Checksum: string;
  _tsDateAdded: number;
  _sDownloadUrl: string;
  _bIsArchived: boolean;
}

export interface GameBananaModData {
  modId: number;

  name: string;
  author: string;

  category: {
    root: string;
    name: string;
  };

  updatedAt: Date;
  isObsolete: boolean;
  isWithheld: boolean;
  isTrashed: boolean;
  hasUpdates: boolean;

  previews: {
    full: string;
    feed: string;
  };

  latestFile: {
    id: number;
    name: string;
    size: number;
    md5: string;
    date: Date;
    downloadUrl: string;
  } | null;

  updates: {
    title: string;
    text: string;
    version?: string;
    date: Date;
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class GameBananaService {
  private _http = inject(HttpClient);

  private _baseUrl = 'https://api.gamebanana.com';

  public getGBananaImagePath(modId: number | string): string {
    return `https://images.gamebanana.com/img/embeddables/Mod_${modId}_sd_image.jpg`;
  }

  public getModData(modId: number): Observable<GameBananaModData> {
    return this._http
      .get<any[]>(
        `${this._baseUrl}/Core/Item/Data?itemtype=Mod&itemid=${modId}&fields=name%2COwner().name%2CRootCategory().name%2CCategory().name%2Cudate%2Cis_obsolete%2CWithhold().bIsWithheld()%2CTrash().bIsTrashed()%2CUpdates().bSubmissionHasUpdates()%2CUpdates().aLatestUpdates()%2CFiles().aFiles()%2CPreview().sStructuredDataFullsizeUrl()%2CPreview().sSubFeedImageUrl()`
      )
      .pipe(
        map((data): GameBananaModData => {
          const filesMap = (data[10] ?? {}) as Record<string, GameBananaFile>;

          const files = Object.values(filesMap)
            .filter((f: any) => !f._bIsArchived)
            .sort((a: any, b: any) => b._tsDateAdded - a._tsDateAdded);

          const latestFile = files[0];

          return {
            modId,

            name: data[0],
            author: data[1],

            category: {
              root: data[2],
              name: data[3],
            },

            updatedAt: new Date(data[4] * 1000),

            isObsolete: data[5] === true || data[5] === 'true',
            isWithheld: data[6],
            isTrashed: data[7],
            hasUpdates: data[8],

            previews: {
              full: data[11],
              feed: data[12],
            },

            latestFile: latestFile
              ? {
                  id: latestFile._idRow,
                  name: latestFile._sFile,
                  size: latestFile._nFilesize,
                  md5: latestFile._sMd5Checksum,
                  date: new Date(latestFile._tsDateAdded * 1000),
                  downloadUrl: latestFile._sDownloadUrl,
                }
              : null,

            updates: (data[9] ?? []).map((u: any) => ({
              title: u._sTitle ?? '',
              text: u._sText ?? '',
              version: u._sVersion,
              date: new Date(u._tsDateAdded * 1000),
            })),
          };
        })
      );
  }
}
