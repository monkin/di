# @monkin/di

[![Tests](https://github.com/monkin/di/actions/workflows/test.yml/badge.svg)](https://github.com/monkin/di/actions/workflows/test.yml)
[![NPM version](https://img.shields.io/npm/v/@monkin/di.svg)](https://www.npmjs.com/package/@monkin/di)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`@monkin/di` is a lightweight (461 bytes), type-safe dependency injection container for TypeScript. It leverages TypeScript's advanced type system to provide a fluent API for service registration and resolution with full type safety and autocompletion.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [1. Defining a Service](#1-defining-a-service)
  - [2. Basic Injection](#2-basic-injection)
  - [3. Services with Dependencies](#3-services-with-dependencies)
  - [4. Merging Containers](#4-merging-containers)
  - [5. Lazy](#5-lazy)
  - [6. Duplicate Service Name Protection](#6-duplicate-service-name-protection)
  - [7. Reserved Field Names](#7-reserved-field-names)
  - [8. Circular Dependencies](#8-circular-dependencies)
- [API Reference](#api-reference)
- [Development](#development)
- [License](#license)

## Features

- **Full Type Safety**: Get autocompletion and type checks for all your injected services.
- **No Decorators**: No need for `reflect-metadata` or experimental decorators. Pure TypeScript.
- **Fluent API**: Chainable service registration makes it easy to compose your container.
- **Container Composition**: Merge multiple containers together to share dependencies across different parts of your application.
- **Lazy**: Services are instantiated only on demand (when first accessed) and reused for subsequent accesses.
- **Zero Runtime Dependencies**: Extremely lightweight (461 bytes minified / 318 bytes gzipped).

## Installation

```bash
npm install @monkin/di
```

## Usage

### 1. Defining a Service

A service is a class that implements the `DiService` interface. It must implement a `getServiceName()` method which will be used as the key in the container. Use `as const` to ensure the name is treated as a literal type.

```typescript
import { DiService } from '@monkin/di';

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

Use `DiContainer` to register and resolve your services. You can register a single service or multiple services in one call. When registering multiple services, the order doesn't matter; they can even depend on each other.

```typescript
import { DiContainer } from '@monkin/di';
import { LoggerService } from './LoggerService';
import { ConfigService } from './ConfigService';

// Single service
const container = new DiContainer()
    .inject(LoggerService);

// Multiple services in one call (order-independent)
const multiContainer = new DiContainer()
    .inject(ConfigService, LoggerService);

// Access the service directly on the container
container.logger.log("Service is ready!");
```

### 3. Services with Dependencies

To inject dependencies into a service, define its constructor to accept the container. You can use the `Di<...T>` type helper to specify which services are required. It supports multiple services passed as separate arguments or as a tuple.

```typescript
import { Di, DiService } from '@monkin/di';
import { LoggerService } from './LoggerService';
import { ConfigService } from './ConfigService';

export class UserService implements DiService<"user"> {
    getServiceName() {
        return "user" as const;
    }
    
    // Single dependency:
    // constructor(private di: Di<LoggerService>) {}

    // Multiple dependencies:
    constructor(private di: Di<LoggerService, ConfigService>) {}

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

When using `inject` with multiple services, they can depend on each other regardless of the order they are passed to the method.

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

### 5. Lazy

Services registered via `inject` are lazy by default. When you register a service, `@monkin/di` creates a **Proxy** for it on the container. The actual service instance is only created when you first interact with it (e.g., call a method, access a property). Once created, the same instance is reused for all subsequent accesses.

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

`@monkin/di` prevents registering multiple services with the same name. This protection works at both compile-time and runtime:

- **Type-level Check**: If you try to `inject` a service with a name that already exists in the container, TypeScript will report an error, and the resulting type will be a string literal describing the error.
- **Runtime Check**: The `inject` and `injectContainer` methods will throw an `Error` if a duplicate key is detected.

```typescript
const container = new DiContainer()
    .inject(LoggerService);

// TypeScript Error: Type '"Duplicate service name: logger"' ...
// Runtime Error: Duplicated service name: logger
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
// Runtime Error: Reserved service name: inject
container.inject(InjectService);
```

### 8. Circular Dependencies

`@monkin/di` supports circular dependencies between services because it uses **Proxies** for lazy initialization. A service can depend on another service that depends back on it, provided that they don't try to access each other's methods or properties in their constructors.

```typescript
class ServiceA implements DiService<"a"> {
    getServiceName() { return "a" as const; }
    constructor(private di: Di<ServiceB>) {}
    
    doA() {
        console.log("A doing something...");
        this.di.b.doB();
    }
}

class ServiceB implements DiService<"b"> {
    getServiceName() { return "b" as const; }
    constructor(private di: Di<ServiceA>) {}
    
    doB() {
        console.log("B doing something...");
    }
}

const container = new DiContainer().inject(ServiceA, ServiceB);
container.a.doA(); // Works fine!
```

> [!IMPORTANT]
> Do not access circular dependencies in the constructor, as this will trigger a stack overflow during instantiation.

## API Reference

### `DiContainer`

The main class for managing services.

- `inject(...ServiceClasses: new (di: any) => any): DiContainer`
  Registers one or more service classes. Returns the container instance, typed with the newly added services. Each service can depend on other services provided in the same call or already present in the container.
- `injectContainer<DC extends DiContainer>(other: DC): this & DC`
  Copies all services from another container into this one. Returns the container instance, typed with the merged services.

### `DiService<Name>`

An interface that your service classes must implement.

- `getServiceName(this: null): Name`
  Must return the unique name of the service as a string literal type.

### `Di<...S>`

A utility type to help define dependencies in your service constructors.

- `Di<ServiceClass>`: Resolves to an object with the service name as the key and the service instance as the value.
- `Di<Service1, Service2, ...>`: Resolves to a merged object containing all specified services.

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

