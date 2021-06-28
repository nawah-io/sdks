export type Require<T, K extends keyof T> = T & { [P in K]: Required<P> };

export interface SDKConfig {
  api: string;
  anonToken: string;
  authAttrs: Array<string>;
  appId: string;
  debug?: boolean;
  cacheKey?: string;
}

export interface QueryStep {
  $search?: string;
  $sort?: {
    [attr: string]: 1 | -1;
  };
  $skip?: number;
  $limit?: number;
  $extn?: false | Array<string>;
  $attrs?: Array<string>;
  $group?: Array<{
    by: string;
    count: number;
  }>;
  $geo_near?: {
    val: [number, number];
    attr: string;
    dist: number;
  };
  [attr: string]:
    | {
        $ne: number | string | boolean;
      }
    | {
        $eq: number | string | boolean;
      }
    | {
        $regex: string;
      }
    | {
        $gt: number | string;
      }
    | {
        $gte: number | string;
      }
    | {
        $lt: number | string;
      }
    | {
        $lte: number | string;
      }
    | {
        $bet: [number, number] | [string, string];
      }
    | {
        $all: Array<number | string>;
      }
    | {
        $nin: Array<number | string>;
      }
    | {
        $in: Array<number | string>;
      }
    | {
        $attrs: Array<string>;
      }
    | {
        $skip: false | Array<string>;
      }
    | Query
    | string
    | { [attr: string]: 1 | -1 }
    | number
    | boolean
    | Array<string>
    | {
        val: [number, number];
        attr: string;
        dist: number;
      }
    | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Query extends Array<QueryStep | Query> {}

export interface CallArgs {
  call_id?: string;
  endpoint: string;
  sid?: string;
  token?: string;
  query?: Query;
  doc?: { [key: string]: unknown };
  // doc?: {
  //   [key: string]:
  //     | number
  //     | string
  //     | boolean
  //     | Doc
  //     | DocAttrDict
  //     | DocAttrArray
  //     | { $add: number }
  //     | { $multiply: number }
  //     | {
  //         $append: number | string | boolean | Doc | DocAttrDict | DocAttrArray;
  //       }
  //     | {
  //         $set_index: {
  //           [key: number]:
  //             | number
  //             | string
  //             | boolean
  //             | Doc
  //             | DocAttrDict
  //             | DocAttrArray;
  //         };
  //       }
  //     | {
  //         $del_val:
  //           | number
  //           | string
  //           | boolean
  //           | Doc
  //           | DocAttrDict
  //           | DocAttrArray;
  //       }
  //     | { $del_index: number };
  // };
  awaitAuth?: boolean;
}

export interface Res<T> {
  args: {
    code: string;
    watch: string;
    docs: T[];
    count: number;
    total: number;
    groups: any;
    session: Session;
    call_id: string;
  };
  msg: string;
  status: number;
};

export interface Doc {
  _id: string;
  [key: string]: number | string | boolean | Doc | DocAttrDict | DocAttrArray;
}

export interface DocAttrDict {
  [key: string]: number | string | boolean | Doc | DocAttrDict | DocAttrArray;
}

export interface DocAttrArray {
  [key: number]: number | string | boolean | Doc | DocAttrDict | DocAttrArray;
}

export interface Session extends Doc {
  user: User;
  host_add: string;
  user_agent: string;
  timestamp: string;
  expiry: string;
  token: string;
}

export interface User extends Doc {
  name: { [key: string]: string };
  locale: string;
  create_time: string;
  login_time: string;
  groups: Array<string>;
  privileges: { [key: string]: Array<string> };
  status: 'active' | 'banned' | 'deleted' | 'disabled_password';
}
