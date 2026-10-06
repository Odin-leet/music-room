import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases (e.g. the ones added by `nest g library`) live in tsconfig.json,
// so they are read from there instead of being duplicated here.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    // fractional-indexing ships ESM only. Node 22 can require() it at
    // runtime, but Jest can't, so compile just that package to CommonJS.
    '^.+/node_modules/fractional-indexing/.+\\.js$': [
      'ts-jest',
      { tsconfig: { allowJs: true, module: 'commonjs' } },
    ],
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // node_modules are normally left untransformed; make an exception for it.
  transformIgnorePatterns: ['/node_modules/(?!fractional-indexing/)'],
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    'libs/**/*.(t|j)s',
    'apps/**/*.(t|j)s',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
