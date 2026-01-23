/*******************************************************************
 *                         重要提醒
 * 这个文件是执行 gulux dev 命令临时生成的文件，切记不要更改或提交代码仓库 !!!
 *
 ******************************************************************/

import { GuluXApplication } from '@gulux/gulux';

async function main() {
  const app = await GuluXApplication.start({
    root:'/Users/bytedance/Desktop/seeseezz/gulux/server',
    configDir: 'config',
    exclude: 'coverage,test,output,log,.bootstrap.ts,bootstrap.ts'.split(','),
    // @ts-ignore
    dumpRuntimeInfo: false,
  });

  return app;
}

main();
