export interface ProcessStep {
  title: string;
  /** One line, for the homepage. */
  summary: string;
  /** The fuller explanation, for the About page. */
  details: string;
  /** What the photograph for this step should show. */
  photo: string;
  /** The photograph itself (4:5, in /public). Steps without one show a grey placeholder describing `photo`. */
  image?: string;
  /** Which part of a picture that is not 4:5 stays in the frame (CSS object-position), for example "48% 50%". */
  imagePosition?: string;
}

/**
 * How a piece is made, from timber to finished piece. Shown briefly on the homepage and in full, with a picture for each
 * step, on the About page. This is a general description (drying, grit sequence and coating steps follow common furniture-shop practice); the business should review it against how its workshop really works.
 */
export const PROCESS: ProcessStep[] = [
  {
    title: "Timber selection",
    summary: "Boards picked for the job: the right wood, colour and grain.",
    details:
      "The planks are checked for straightness, sound areas and grain before being set aside for the different parts of the furniture. Wider sections are suited to tabletops, doors and panels, while straighter lengths are used for legs and rails. The timber is kiln-dried for indoor use, which helps limit changes in shape after it has been made into furniture.",
    photo: "Timber boards being selected",
    image: "/about/step-1-timber-selection.png",
  },
  {
    title: "Cutting",
    summary: "Measured against the drawing and cut with room to plane.",
    details:
      "The timber is marked out to the dimensions needed for each part, then cut and trimmed to size. Matching parts, such as legs or cabinet sides, are prepared together so their lengths and edges line up. The cut edges are squared and checked before the parts move on, giving the frame and panels a sound fit when they are brought together.",
    photo: "Boards being measured and cut",
    image: "/about/step-2-cutting.jpg",
  },
  {
    title: "Joinery and assembly",
    summary: "Joints cut to fit, dry-fitted, then glued and clamped square.",
    details:
      "The parts are fitted together to form the frame, cabinet or other main structure. Where rails meet legs, the ends are shaped to sit securely in matching openings; glue and clamps hold the connection while it sets. The frame is checked as it is assembled so its corners remain square and the legs sit evenly. Panels, shelves, drawers and doors are then fitted to the structure and checked for smooth movement and an even fit.",
    photo: "A piece being fitted, glued and clamped",
    image: "/about/step-3-joinery-and-assembly.jpg",
    // A tall picture: keep the joints at the top of the corner.
    imagePosition: "50% 30%",
  },
  {
    title: "Sanding",
    summary: "Sanded smooth through the grades and the edges softened.",
    details:
      "Rough areas, saw marks and small blemishes are smoothed in stages, starting with a coarser abrasive and moving to finer ones. The final passes follow the grain to leave an even surface, while edges and shaped areas are sanded by hand so they keep their intended form. Before coating, the surfaces are checked by hand and in good light for scratches or rough spots that might otherwise show through.",
    photo: "A surface being sanded",
  },
  {
    title: "Finishing",
    summary: "Stain and a protective finish in the sheen you choose.",
    details:
      "A sample is used to check how the selected coating looks on the timber before it is applied to the furniture. The coating is spread or sprayed in even layers, with time allowed for each layer to dry. Between layers, the surface may be lightly sanded and cleaned to remove small raised spots or dust. The final coats bring an even appearance to the visible surfaces and help protect them during everyday use.",
    photo: "A finished piece being checked",
  },
];
