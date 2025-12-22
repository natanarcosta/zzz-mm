import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

export interface GameBananaModData {
  name: string;
  fullSizePreview: string;
  feedPreview: string;
  updated_at: Date;
}

@Injectable({
  providedIn: 'root',
})
export class GameBananaService {
  private _http = inject(HttpClient);

  private _baseUrl = 'https://api.gamebanana.com';

  public getGBImage(modId: number | string): string {
    return `https://images.gamebanana.com/img/embeddables/Mod_${modId}_sd_image.jpg`;
  }

  public getModData(modId: number): Observable<GameBananaModData> {
    return this._http
      .get<string[]>(
        `${this._baseUrl}/Core/Item/Data?itemtype=Mod&itemid=${modId}&fields=name%2CPreview%28%29.sStructuredDataFullsizeUrl%28%29%2CPreview%28%29.sSubFeedImageUrl%28%29%2Cudate`
      )
      .pipe(
        map((data) => {
          return {
            name: data[0],
            fullSizePreview: data[1],
            feedPreview: data[2],
            updated_at: new Date(+data[3] * 1000),
          };
        })
      );
  }
}
