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
        $ne: any;
      }
    | {
        $eq: any;
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
        $all: Array<any>;
      }
    | {
        $nin: Array<any>;
      }
    | {
        $in: Array<any>;
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

export interface Query extends Array<QueryStep | Query> {}

export interface CallArgs {
  call_id?: string;
  endpoint: string;
  sid?: string;
  token?: string;
  query?: Query;
  doc?: {
    [attr: string]: any;
  };
  awaitAuth?: boolean;
}

export type ResArgsDoc<T = any> = {
  call_id: string;
  watch?: string;
  docs: Array<T>;
  count: number;
  total: number;
  groups: any;
};

export type ResArgsMsg = {
  call_id: string;
  code: string;
};

export type ResArgsSession = {
  call_id: string;
  session: Session;
};

export type Res<T, U = ResArgsMsg | ResArgsDoc<T> | ResArgsSession> = {
  args: U extends ResArgsDoc<any> ? ResArgsDoc<T> : U;
  msg: string;
  status: number;
};

export interface Doc {
  _id: string;
  [key: string]: any;
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
