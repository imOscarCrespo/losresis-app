import { DEFAULT_TOOLBAR_ITEMS } from "@10play/tentap-editor";
import { COLORS } from "../../../constants/colors";

/*
 * Barra de formato del editor de ResiNotes (ClickUp 124b4z9w5nh).
 *
 * Primero lo más usado (negrita, cursiva, subrayado, tachado y las tres
 * listas) y después el resto de herramientas que ya había, sin quitar
 * ninguna. Los botones vienen de TenTap; aquí solo se reordenan y se les pone
 * la etiqueta en español (lectores de pantalla y Maestro).
 */

const PRIORITY = [
  ["Bold", "Negrita"],
  ["Italic", "Cursiva"],
  ["Underline", "Subrayado"],
  ["Strikethrough", "Tachado"],
  ["Bullet list", "Lista con viñetas"],
  ["Ordered list", "Lista numerada"],
  ["Task list", "Lista de tareas"],
];
const REST = [
  ["Link", "Enlace"],
  ["Heading", "Encabezado"],
  ["Quote", "Cita"],
  ["Code", "Código"],
  ["Indent", "Aumentar sangría"],
  ["Outdent", "Reducir sangría"],
  ["Undo", "Deshacer"],
  ["Redo", "Rehacer"],
];

/** Los botones de TenTap en el orden de ResiNotes; los que no se conocen van al final. */
export const orderToolbarItems = (items = DEFAULT_TOOLBAR_ITEMS) => {
  const byLabel = new Map(items.map((item) => [item.label, item]));
  const ordered = [];
  [...PRIORITY, ...REST].forEach(([label, es]) => {
    const item = byLabel.get(label);
    if (!item) return;
    ordered.push({ ...item, label: es });
    byLabel.delete(label);
  });
  return [...ordered, ...byLabel.values()];
};

export const RESINOTES_TOOLBAR_ITEMS = orderToolbarItems();

/**
 * Colores: disponible = icono oscuro; activo = morado de LosResis sobre fondo
 * lavanda; deshabilitado = gris claro (además se atenúa, para no depender solo
 * del color). Botones de 44 pt de alto con separación entre ellos.
 */
export const RESINOTES_TOOLBAR_THEME = {
  toolbarBody: {
    borderTopColor: COLORS.BORDER,
    borderBottomColor: COLORS.BORDER,
    backgroundColor: COLORS.WHITE,
    height: 52,
  },
  toolbarButton: {
    paddingHorizontal: 3,
    backgroundColor: COLORS.WHITE,
  },
  iconWrapper: {
    borderRadius: 10,
    padding: 6,
    backgroundColor: COLORS.WHITE,
  },
  iconWrapperActive: {
    backgroundColor: "#EDE4FF",
  },
  iconWrapperDisabled: {
    opacity: 0.45,
  },
  icon: {
    width: 26,
    height: 26,
    tintColor: COLORS.PRIMARY_DARK,
  },
  iconActive: {
    tintColor: COLORS.PRIMARY,
  },
  iconDisabled: {
    tintColor: "#CBD5E1",
  },
};
