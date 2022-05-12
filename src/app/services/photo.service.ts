/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Injectable } from '@angular/core';
import {
  Camera,
  CameraResultType,
  CameraSource,
  Photo,
} from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Storage } from '@capacitor/storage';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class PhotoService {
  public photos: UserPhoto[] = [];
  private PHOTO_STORAGE = 'photos';
  private platform: Platform;

  constructor(platform: Platform, private http: HttpClient) {
    this.platform = platform;
  }

  public async addNewToGallery() {
    //Otvaranje kamere
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100,
    });
    //Iz Photo trebamo u UserPhoto pretvorit
    const savedImageFile = await this.savePicture(capturedPhoto);
    this.photos.unshift(savedImageFile);

    //Spremanje u local storage
    Storage.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos),
    });
    //Ucitavanje svih slika u listi u base64 formatu
    this.loadSaved();
  }

  removePhoto() {
    this.photos = [];
    Storage.clear();
  }

  public async loadSaved() {
    //Dohvat liste slika iz photo-storage sa uređaja
    const photoList = await Storage.get({ key: this.PHOTO_STORAGE });
    this.photos = JSON.parse(photoList.value) || [];

    //Provjera jesmo li na mobilnom uređaju ili na računalu ovisno o tome na taj način prikazujemo podatke
    if (!this.platform.is('hybrid')) {
      for (let photo of this.photos) {
        const readFile = await Filesystem.readFile({
          path: photo.filepath,
          directory: Directory.Data,
        });

        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      }
    }
  }

  public sendToBackend(data: string) {
    console.log(data);
    //iz base64 url pretvorit u File
    let image = this.dataURLtoFile(data, 'test');
    const formData = new FormData();
    formData.append('file', image);
    this.http
      .post(
        'http://ip172-18-0-76-c9uetq09jotg00fqsaj0-8080.direct.labs.play-with-docker.com/api/image',
        formData,
        { responseType: 'blob' }
      )
      .subscribe({
        next: (response) => {
          this.saveBlobPictureToList(response);
        },
        error: (error) => console.log(error),
      });
  }

  private dataURLtoFile(dataurl, filename): File {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  }

  private async savePicture(photo: Photo) {
    //pročitamo sliku kao base64
    const base64Data = await this.readAsBase64(photo);

    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });

    if (this.platform.is('hybrid')) {
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
      };
    } else {
      return {
        filepath: fileName,
        webviewPath: photo.webPath,
      };
    }
  }

  private async saveBase64Photo(base64Data: string) {
    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });

    if (this.platform.is('hybrid')) {
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
      };
    } else {
      return {
        filepath: fileName,
        webviewPath: base64Data,
      };
    }
  }

  private async saveBlobPictureToList(blob: Blob) {
    //dobiveni blob konvertiramo base64 string
    let data = (await this.convertBlobToBase64(blob)) as string;
    //konvertiramo taj string u UserPhoro interface da ga možemo spremit u listu
    let savedImageFIle = await this.saveBase64Photo(data);
    this.photos.unshift(savedImageFIle);

    Storage.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos),
    });
  }

  private async readAsBase64(photo: Photo) {
    if (this.platform.is('hybrid')) {
      const file = await Filesystem.readFile({
        path: photo.path,
      });

      return file.data;
    } else {
      const response = await fetch(photo.webPath);
      const blob = await response.blob();

      return (await this.convertBlobToBase64(blob)) as string;
    }
  }

  private convertBlobToBase64 = (blob: Blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });
}

export interface UserPhoto {
  filepath: string;
  webviewPath: string;
}
