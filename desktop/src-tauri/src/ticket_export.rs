use serde::Deserialize;
use std::{io::Write, path::Path, sync::Mutex};
use tauri::WebviewWindow;
use tauri_plugin_dialog::DialogExt;

static EXPORT_DIALOG: Mutex<()> = Mutex::new(());
const MAX_ROWS: usize = 160;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TicketExportRow {
    kind: String,
    reference: String,
    title: String,
    status: String,
    classification: String,
    application: String,
    environment: String,
}

fn ticket_csv(rows: &[TicketExportRow]) -> Result<String, &'static str> {
    if rows.is_empty() || rows.len() > MAX_ROWS {
        return Err("export_invalid_rows");
    }
    let mut csv = String::from(
        "Type,Reference,Title,Status,Severity or priority,Application,Environment\r\n",
    );
    for row in rows {
        let cells = [
            (row.kind.as_str(), 24),
            (&row.reference, 256),
            (&row.title, 240),
            (&row.status, 32),
            (&row.classification, 32),
            (&row.application, 120),
            (&row.environment, 120),
        ];
        for (index, (value, max)) in cells.into_iter().enumerate() {
            if value.len() > max * 4 || value.contains('\0') {
                return Err("export_invalid_rows");
            }
            if index > 0 {
                csv.push(',');
            }
            csv.push('"');
            let trimmed = value.trim_start_matches(|c: char| {
                c.is_whitespace() || c.is_control() || c == '\u{feff}'
            });
            if value.starts_with(['\t', '\r', '\n'])
                || trimmed.starts_with(['=', '+', '-', '@', '＝', '＋', '－', '＠'])
            {
                csv.push('\'');
            }
            csv.push_str(&value.replace('"', "\"\""));
            csv.push('"');
        }
        csv.push_str("\r\n");
    }
    Ok(csv)
}

fn save_csv(path: &Path, csv: &[u8]) -> Result<(), &'static str> {
    if !path.is_absolute()
        || !path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("csv"))
    {
        return Err("export_invalid_destination");
    }
    let parent = path.parent().ok_or("export_invalid_destination")?;
    let mut file = tempfile::Builder::new()
        .prefix(".v19-tickets-")
        .tempfile_in(parent)
        .map_err(|_| "export_write_failed")?;
    file.write_all(csv)
        .and_then(|_| file.as_file().sync_all())
        .map_err(|_| "export_write_failed")?;
    file.persist_noclobber(path).map_err(|failure| {
        if failure.error.kind() == std::io::ErrorKind::AlreadyExists {
            "export_already_exists"
        } else {
            "export_write_failed"
        }
    })?;
    Ok(())
}

#[tauri::command]
pub async fn export_ticket_csv(
    window: WebviewWindow,
    rows: Vec<TicketExportRow>,
) -> Result<bool, String> {
    if window.label() != "main" {
        return Err("export_unavailable".into());
    }
    let csv = ticket_csv(&rows)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _dialog = EXPORT_DIALOG.try_lock().map_err(|_| "export_busy")?;
        let Some(destination) = window
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("Export tickets")
            .set_file_name("v19-tickets.csv")
            .add_filter("CSV", &["csv"])
            .blocking_save_file()
        else {
            return Ok(false);
        };
        let path = destination
            .into_path()
            .map_err(|_| "export_invalid_destination")?;
        save_csv(&path, csv.as_bytes())?;
        Ok::<_, &'static str>(true)
    })
    .await
    .map_err(|_| "export_unavailable")?
    .map_err(String::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(title: &str) -> TicketExportRow {
        TicketExportRow {
            kind: "Deployment incident".into(),
            reference: "INC-019".into(),
            title: title.into(),
            status: "open".into(),
            classification: "high".into(),
            application: "Inventory service".into(),
            environment: "Staging".into(),
        }
    }

    #[test]
    fn quotes_rfc_csv_cells_and_neutralizes_spreadsheet_formulas() {
        let csv = ticket_csv(&[
            row("Inventory, \"staging\"\ncheck"),
            row("  =1+1"),
            row("\tvalue"),
            row("日本語"),
        ])
        .unwrap();
        assert!(csv.contains("\"Inventory, \"\"staging\"\"\ncheck\""));
        assert!(csv.contains("\"'  =1+1\""));
        assert!(csv.contains("\"'\tvalue\""));
        assert!(csv.contains("\"日本語\""));
        assert!(csv.ends_with("\r\n"));
        assert_eq!(ticket_csv(&[]), Err("export_invalid_rows"));
        assert_eq!(
            ticket_csv(&[row(&"X".repeat(961))]),
            Err("export_invalid_rows")
        );
    }

    #[test]
    fn saves_exact_bytes_and_never_clobbers_a_selected_file() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("tickets.csv");
        let csv = ticket_csv(&[row("Inventory validation")]).unwrap();
        assert_eq!(save_csv(&path, csv.as_bytes()), Ok(()));
        assert_eq!(
            save_csv(&path, b"replacement"),
            Err("export_already_exists")
        );
        assert_eq!(std::fs::read(path).unwrap(), csv.as_bytes());
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
        assert_eq!(
            save_csv(&directory.path().join("tickets.txt"), b"x"),
            Err("export_invalid_destination")
        );
    }
}
