export interface ProcessStep {
  title: string;
  /** One line, for the homepage. */
  summary: string;
  /** The fuller explanation, for the About page. */
  details: string;
  /** What the photograph for this step should show. */
  photo: string;
}

/**
 * How a piece is made, from timber to finished piece. Shown briefly on the homepage and in full, with a picture for each
 * step, on the About page. This is a general description; the business should review it against how its workshop really works.
 */
export const PROCESS: ProcessStep[] = [
  {
    title: "Timber selection",
    summary: "Boards picked for the job: the right wood, colour and grain.",
    details:
      "Every piece begins with the wood. We choose boards for the job in hand: the kind of timber, its colour and grain, and how well it will hold its shape. Boards with faults that would weaken the piece or spoil its look are set aside. For a made-to-measure piece, the wood is agreed with you before any work starts.",
    photo: "Timber boards being selected",
  },
  {
    title: "Cutting",
    summary: "Measured against the drawing and cut with room to plane.",
    details:
      "Boards are measured against the drawing and cut to length and width, leaving a little extra for planing. Wherever we can, the parts for one piece come from the same boards, so the colour and the grain run together across the finished piece.",
    photo: "Boards being measured and cut",
  },
  {
    title: "Joinery and assembly",
    summary: "Joints cut to fit, dry-fitted, then glued and clamped square.",
    details:
      "The parts are shaped and fitted together with joints cut to fit, because the joints are what keep a table steady and a chair square for years. Every piece is dry-fitted before any glue goes on, so adjustments are made while they are still easy. It is then glued and clamped, and checked until it is square, flat and level. Hinges, runners and other fittings are added at this stage, and the finished frame is stood up and tested for steadiness before it moves on.",
    photo: "A piece being fitted, glued and clamped",
  },
  {
    title: "Sanding",
    summary: "Sanded smooth through the grades and the edges softened.",
    details:
      "Every surface is sanded, by machine and by hand, through the grades until it feels smooth to the touch, and the edges are softened. Careful sanding is what lets the wood take the finish evenly.",
    photo: "A surface being sanded",
  },
  {
    title: "Finishing",
    summary: "Stain and a protective finish in the sheen you choose.",
    details:
      "The finish is applied in coats: a stain first if you want a deeper tone, then a protective finish in the sheen you chose. Samples can be seen in the showroom before work begins. Last, the piece is checked and cleaned, then made ready for delivery or for collection from the showroom.",
    photo: "A finished piece being checked",
  },
];
