# SQL starter

Requires Python 3.11 or newer. The example uses a persistent SQLite database through Python's standard library, so no database server or package install is required.

```sh
python run.py
```

`schema.sql` defines the table, `seed.sql` adds the example rows once, and `queries.sql` contains CRUD and progress queries. The database is saved to `eco.db` beside `run.py` and is ignored by Git.

```sh
python run.py list
python run.py add "Ship the feature"
python run.py complete 1
python -m unittest test_run.py
```
