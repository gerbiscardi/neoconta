# BACKUPS DEL SISTEMA NEOCONTA

Este directorio contiene herramientas y snapshots cifrados para la migración y recuperación ante desastres de NeoConta.

## Archivos en este repositorio:
1. `system_snapshot.enc`: Snapshot operativo cifrado con **AES-256-GCM** y derivación de clave **PBKDF2** (100.000 iteraciones).
   - Contiene la base de datos SQLite con todos los registros, los archivos de configuración de usuarios, certificados fiscales AFIP, historiales de facturas y variables de entorno.
   - Es seguro para el repositorio Git ya que no expone datos en texto plano.

## Cómo restaurar en un nuevo servidor:
```bash
node scripts/restore_system.mjs
```

## Cómo generar un nuevo snapshot:
```bash
node scripts/backup_manager.mjs
```

Para una guía completa paso a paso, consulte [docs/SERVER_MIGRATION_GUIDE.md](../docs/SERVER_MIGRATION_GUIDE.md).
