# OpenSpec — travesiafiunmdp-main

This directory contains SDD (Spec-Driven Development) artifacts for the travesiafiunmdp-main project.

## Structure

```
openspec/
  config.yaml          # Project configuration, stack, testing, conventions
  changes/             # Change proposals and delta specs
  README.md            # This file
```

## Usage

- Run `sdd init` to regenerate `config.yaml`
- Run `sdd propose` to create a new change proposal in `changes/`
- Run `sdd spec` to write delta specs for a change
- Run `sdd tasks` to break a change into implementation tasks
