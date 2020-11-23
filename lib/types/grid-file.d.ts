export interface GridFile {
    id: any;
    filename: string;
    metadata: any;
    contentType: string;
    chunkSize: number;
    bucketName: string;
    uploadDate: Date;
    md5: string;
    size: number;
}
