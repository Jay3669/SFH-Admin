import { IconButton, Button, Tooltip } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import "./ActionButtons.css";

export function ActionButtonGroup({ children }) {
  return <span className="action-button-group">{children}</span>;
}

export function ViewActionButton({ tooltip = "View", size = "small", ...props }) {
  return (
    <Tooltip title={tooltip}>
      <IconButton className="action-button action-button--view" size={size} aria-label={tooltip} {...props}>
        <VisibilityOutlinedIcon />
      </IconButton>
    </Tooltip>
  );
}

export function EditActionButton({ tooltip = "Edit", size = "small", ...props }) {
  return (
    <Tooltip title={tooltip}>
      <IconButton className="action-button action-button--edit" size={size} aria-label={tooltip} {...props}>
        <EditOutlinedIcon />
      </IconButton>
    </Tooltip>
  );
}

export function DeleteActionButton({ tooltip = "Delete", size = "small", ...props }) {
  return (
    <Tooltip title={tooltip}>
      <IconButton className="action-button action-button--delete" size={size} aria-label={tooltip} {...props}>
        <DeleteOutlineRoundedIcon />
      </IconButton>
    </Tooltip>
  );
}

export function AddButton({ children = "Add", ...props }) {
  return <Button className="standard-action-button standard-action-button--add" startIcon={<AddRoundedIcon />} {...props}>{children}</Button>;
}

export function DownloadButton({ children = "Download", ...props }) {
  return <Button className="standard-action-button standard-action-button--download" startIcon={<DownloadRoundedIcon />} {...props}>{children}</Button>;
}

export function PrintButton({ children = "Print", ...props }) {
  return <Button className="standard-action-button standard-action-button--print" startIcon={<PrintRoundedIcon />} {...props}>{children}</Button>;
}
