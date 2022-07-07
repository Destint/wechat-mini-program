/// <reference path="./types/index.d.ts" />

/** APP全局接口 */
interface IAppOption {
  /** APP全局数据 */
  globalData: {
    /** 本地图片路径字典缓存名 */
    localFilePathDicCacheName: string;
    /** 回忆页分享图片的云路径 */
    memorySharePicCloudPath: string;
    /** 公告缓存名 */
    noticeCacheName: string;
    /** 回忆列表缓存名 */
    memoryListCacheName: string;
    /** 回忆总数缓存名 */
    memorySumCacheName: string;
    /** 用户昵称缓存名 */
    nicknameCacheName: string;
    /** 万年历缓存名 */
    calendarCacheName: string;
    /** 是否有管理权限缓存名 */
    hasManagePermissionCacheName: string;
    /** 是否赞美小程序缓存名 */
    isPraiseAppCacheName: string;
    /** 赞美小程序人数缓存名 */
    praiseAppSumCacheName: string;
  };
  /** 检测小程序版本 有新版本则自动更新 */
  checkAppVersion(): void;
  /** 上传访问记录到云端 */
  uploadAccessToCloud(): void;
  /**
   * 显示提示
   * @param tip 提示内容
   */
  showToast(tip: string): void;
  /**
   * 检测本地图片路径是否存在
   * @param localFilePathDicKey 本地图片路径字典的key
   * @return 本地图片路径
   */
  checkHasLocalFilePath(localFilePathDicKey: string): string;
  /**
   * 下载临时文件路径
   * @param localFilePathDicKey 本地图片路径字典的key
   * @param cloudFilePath 云图片路径
   * @return 临时图片路径
   */
  downloadTempFilePath(localFilePathDicKey: string, cloudFilePath: string): Promise<string>;
  /**
   * 删除本地文件路径的字典
   * @param localFilePathDicKey 本地图片路径字典的key
   */
  deleteLocalFilePathDic(localFilePathDicKey: string): void;
}

/** 单个回忆数据详情 */
interface memoryDetail {
  /** 回忆id */
  id: number;
  /** 回忆标题 */
  title: string;
  /** 回忆内容 */
  content: string;
  /** 云图片路径列表 */
  cloudPicPathList: string[];
  /** 本地图片路径列表 */
  localPicPathList: string[];
  /** 回忆记录日期 */
  date: string;
  /** 回忆简易地址 */
  simpleAddress: string;
  /** 回忆详细地址 */
  address: string;
  /** 云录音地址 */
  cloudRecordPath: string;
  /** 本地录音地址 */
  localRecordPath: string;
  /** 录音时长 */
  recordDuration: number;
}

/** 万年历接口 */
interface calendar {
  /** 日期 */
  date: string;
  /** 年份 */
  year: string;
  /** 月份 */
  month: string;
  /** 天 */
  day: string;
  /** 生肖 */
  zodiac: string;
  /** 农历 */
  lunar: string;
  /** 节气 */
  solarTerm: string;
  /** 今日宜 */
  suitable: string;
  /** 今日忌 */
  tapu: string;
}