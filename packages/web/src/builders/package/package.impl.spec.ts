import { of, throwError } from 'rxjs';
import { join } from 'path';

import { workspaces } from '@angular-devkit/core';

import * as f from '@nrwl/workspace/src/utils/fileutils';
import { MockBuilderContext } from '@nrwl/workspace/testing';

import * as impl from './package.impl';
import * as rr from './run-rollup';
import { getMockContext } from '../../utils/testing';
import { BundleBuilderOptions } from '../../utils/types';
import * as projectGraphUtils from '@nrwl/workspace/src/core/project-graph';
import {
  ProjectGraph,
  ProjectType
} from '@nrwl/workspace/src/core/project-graph';

jest.mock('tsconfig-paths-webpack-plugin');

describe('WebPackagebuilder', () => {
  let context: MockBuilderContext;
  let testOptions: BundleBuilderOptions;
  let runRollup: jasmine.Spy;
  let writeJsonFile: jasmine.Spy;

  beforeEach(async () => {
    context = await getMockContext();
    context.target.project = 'example';
    testOptions = {
      entryFile: 'libs/ui/src/index.ts',
      outputPath: 'dist/ui',
      project: 'libs/ui/package.json',
      tsConfig: 'libs/ui/tsconfig.json',
      watch: false
    };
    spyOn(workspaces, 'readWorkspace').and.returnValue({
      workspace: {
        projects: {
          get: () => ({
            sourceRoot: join(__dirname, '../../..')
          })
        }
      }
    });
    spyOn(f, 'readJsonFile').and.returnValue({
      name: 'example'
    });
    writeJsonFile = spyOn(f, 'writeJsonFile');

    spyOn(projectGraphUtils, 'createProjectGraph').and.callFake(() => {
      return {
        nodes: {},
        dependencies: {}
      } as ProjectGraph;
    });
  });

  describe('run', () => {
    it('should call runRollup with esm and umd', async () => {
      runRollup = spyOn(rr, 'runRollup').and.callFake(() => {
        return of({
          success: true
        });
      });
      spyOn(context.logger, 'info');

      const result = await impl.run(testOptions, context).toPromise();

      expect(runRollup).toHaveBeenCalled();
      expect(runRollup.calls.allArgs()[0][0].output.map(o => o.format)).toEqual(
        expect.arrayContaining(['esm', 'umd'])
      );
      expect(result.success).toBe(true);
      expect(context.logger.info).toHaveBeenCalledWith('Bundle complete.');
    });

    it('should return failure when rollup fails', async () => {
      runRollup = spyOn(rr, 'runRollup').and.callFake(() => throwError('Oops'));
      spyOn(context.logger, 'error');

      const result = await impl.run(testOptions, context).toPromise();

      expect(result.success).toBe(false);
      expect(f.writeJsonFile).not.toHaveBeenCalled();
      expect(context.logger.error).toHaveBeenCalledWith('Bundle failed.');
    });

    it('updates package.json', async () => {
      runRollup = spyOn(rr, 'runRollup').and.callFake(() => {
        return of({
          success: true
        });
      });
      await impl.run(testOptions, context).toPromise();

      expect(f.writeJsonFile).toHaveBeenCalled();

      const content = writeJsonFile.calls.allArgs()[0][1];
      expect(content).toMatchObject({
        name: 'example',
        main: './example.umd.js',
        module: './example.esm.js',
        typings: './index.d.ts'
      });
    });
  });
});
