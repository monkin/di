# di-sacala

[![Tests](https://github.com/monkin/di-sacala/actions/workflows/test.yml/badge.svg)](https://github.com/monkin/di-sacala/actions/workflows/test.yml)
[![NPM version](https://img.shields.io/npm/v/di-sacala.svg)](https://www.npmjs.com/package/di-sacala)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`di-sacala` is a lightweight, type-safe dependency injection container for TypeScript. It leverages TypeScript's advanced type system to provide a fluent API for service registration and resolution with full type safety and autocompletion.

## Table of Contents

- [Features](#features)
- [Motivation](#motivation)
- [Installation](#installation)
- [Usage](#usage)
  - [1. Defining a Service](#1-defining-a-service)
  - [2. Basic Injection](#2-basic-injection)
  - [3. Services with Dependencies](#3-services-with-dependencies)
  - [4. Merging Containers](#4-merging-containers)
  - [5. Lazy & Singleton](#5-lazy--singleton)
  - [6. Duplicate Service Name Protection](#6-duplicate-service-name-protection)
  - [7. Reserved Field Names](#7-reserved-field-names)
- [API Reference](#api-reference)
- [Development](#development)
- [License](#license)

## Features

- **Full Type Safety**: Get autocompletion and type checks for all your injected services.
- **No Decorators**: No need for `reflect-metadata` or experimental decorators. Pure TypeScript.
- **Fluent API**: Chainable service registration makes it easy to compose your container.
- **Container Composition**: Merge multiple containers together to share dependencies across different parts of your application.
- **Lazy & Singleton**: Services are instantiated only on demand (when first accessed) and reused for subsequent accesses.
- **Zero Runtime Dependencies**: Extremely lightweight.

## Installation

```bash
npm install di-sacala
```

## Usage

### 1. Defining a Service

A service is a class that implements the `DiService` interface. It must implement a `getServiceName()` method which will be used as the key in the container. Use `as const` to ensure the name is treated as a literal type.

```typescript
import { DiService } from 'di-sacala';

export class LoggerService implements DiService<"logger"> {
    getServiceName() {
        return "logger" as const;
    }
    
    log(message: string) {
        console.log(`[LOG]: ${message}`);
    }
}
```

### 2. Basic Injection

Use `DiContainer` to register and resolve your services.

```typescript
import { DiContainer } from 'di-sacala';
import { LoggerService } from './LoggerService';

const container = new DiContainer()
    .inject(LoggerService);

// Access the service directly on the container
container.logger.log("Service is ready!");
```

### 3. Services with Dependencies

To inject dependencies into a service, define its constructor to accept the container. You can use the `Di<T>` type helper to specify which services are required. It supports both a single service type or a tuple of multiple services.

```typescript
import { Di, DiService } from 'di-sacala';
import { LoggerService } from './LoggerService';
import { ConfigService } from './ConfigService';

export class UserService implements DiService<"user"> {
    getServiceName() {
        return "user" as const;
    }
    
    // Single dependency:
    // constructor(private di: Di<LoggerService>) {}

    // Multiple dependencies using a tuple:
    constructor(private di: Di<[LoggerService, ConfigService]>) {}

    getUser(id: string) {
        const prefix = this.di.config.get("userPrefix");
        this.di.logger.log(`Fetching user: ${prefix}${id}`);
        return { id, name: "User " + id };
    }
}

const container = new DiContainer()
    .inject(LoggerService)
    .inject(ConfigService)
    .inject(UserService);

container.user.getUser("42");
```

### 4. Merging Containers

You can create specialized containers and merge them into a main container using `injectContainer`.

```typescript
const authContainer = new DiContainer().inject(AuthService);
const apiContainer = new DiContainer().inject(ApiService);

const appContainer = new DiContainer()
    .injectContainer(authContainer)
    .injectContainer(apiContainer)
    .inject(MainApp);
```

### 5. Lazy & Singleton

Services registered via `inject` are lazy by default. When you register a service, `di-sacala` creates a **Proxy** for it on the container. The actual service instance is only created when you first interact with it (e.g., call a method, access a property, or check `instanceof`). Once created, the same instance is reused for all subsequent accesses (singleton).

```typescript
const container = new DiContainer()
    .inject(ExpensiveService);

// ExpensiveService is NOT instantiated yet
const service = container.expensive; 
// Still NOT instantiated! `service` is a Proxy.

console.log("Container ready");

// ExpensiveService is instantiated NOW because we access a property/method
service.doSomething();
```

### 6. Duplicate Service Name Protection

`di-sacala` prevents registering multiple services with the same name. This protection works at both compile-time and runtime:

- **Type-level Check**: If you try to `inject` a service with a name that already exists in the container, TypeScript will report an error, and the resulting type will be a string literal describing the error.
- **Runtime Check**: The `inject` and `injectContainer` methods will throw an `Error` if a duplicate key is detected.

```typescript
const container = new DiContainer()
    .inject(LoggerService);

// TypeScript Error: Type '"Duplicate service name: logger"' ...
// Runtime Error: Duplicate service name: logger
container.inject(AnotherLoggerService); 
```

### 7. Reserved Field Names

Since `DiContainer` uses a fluent API, certain names are reserved for its internal methods and cannot be used as service names:

- `inject`
- `injectContainer`

Similar to duplicate names, attempting to use a reserved name will trigger both a **Type-level Check** and a **Runtime Check**.

```typescript
class InjectService implements DiService<"inject"> {
    getServiceName() { return "inject" as const; }
}

const container = new DiContainer();

// TypeScript Error: Type '"Reserved field name: inject"' ...
// Runtime Error: Reserved field name: inject
container.inject(InjectService);
```

## API Reference

### `DiContainer`

The main class for managing services.

- `inject(ServiceClass: new (di: this) => S): DiContainer & Di<S>`
  Registers a service class. Returns the container instance, typed with the newly added service.
- `injectContainer(other: DiContainer): DiContainer & ...`
  Copies all services from another container into this one.

### `DiService<Name>`

An interface that your service classes must implement.

- `getServiceName(this: null): Name`
  Must return the unique name of the service as a string literal type.

### `Di<S>`

A utility type to help define dependencies in your service constructors.

- `Di<ServiceClass>`: Resolves to an object with the service name as the key and the service instance as the value.
- `Di<[Service1, Service2]>`: Resolves to a merged object containing all specified services.

## Development

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
npm run test:watch  # Watch mode
```

### Linting & Formatting

```bash
npm run lint          # Run Biome check (lint, format, and import sorting)
npm run format        # Format code with Biome
npm run format:check  # Check code formatting with Biome
```

## License

MIT

