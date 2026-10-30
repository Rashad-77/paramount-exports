/**
 * The owner's guide to the dashboard, written as questions and answers. Each entry has a short answer (shown on the closed bar), the steps in
 * detail (shown when it is opened), optional tips, and keywords: other words someone might use for the same thing, which the search on the Guide
 * page also matches. Plain text only. Keep the wording to what the dashboard really does.
 */
export interface GuideItem {
  id: string;
  section: string;
  question: string;
  /** One or two sentences: the answer in short. */
  answer: string;
  /** The detailed guide, one step per line. */
  steps?: string[];
  /** Good to know. */
  tips?: string[];
  /** Other words for the same thing (space separated). */
  keywords: string;
  /** Where in the dashboard to do it. */
  link?: { href: string; label: string };
}

export const GUIDE_SECTIONS = ["Getting started", "Products", "Categories", "Orders", "Quotations and enquiries", "Reviews", "Gallery", "Settings", "When something looks wrong"] as const;

export const GUIDE: GuideItem[] = [
  // ── Getting started ────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "sign-in",
    section: "Getting started",
    question: "How do I sign in and out?",
    answer: "Use the owner sign-in page with your email and password. You are signed out automatically after a while without use, and always after a working day.",
    steps: [
      "Open the owner sign-in page of the website (the address ends in /login).",
      "Type your email and password and press Sign in. You arrive on the page you were trying to open.",
      "To leave, use the sign-out button in the menu.",
      "If a message says you were signed out for your security, just sign in again: nothing you saved is lost.",
    ],
    tips: ["Anything typed into a form but not saved is lost when you are signed out, so save as you go."],
    keywords: "login log in logout log out password expired timeout signed out security",
  },
  {
    id: "account",
    section: "Getting started",
    question: "How do I change my name, email or password?",
    answer: "Open Your account. There you can change your name, the email you sign in with, and your password.",
    steps: ["Open Your account from the account menu.", "Change the name, press Save name.", "For the email or password, fill in the form for it and save. You may be asked for your current password."],
    keywords: "profile account email password change reset forgot sign-in details",
    link: { href: "/app/account", label: "Your account" },
  },
  {
    id: "language",
    section: "Getting started",
    question: "How do I switch the dashboard between English and Sinhala?",
    answer: "Use the English and සිංහල buttons in the top bar. Your choice is remembered, so the dashboard opens in the language you last picked.",
    steps: [
      "Look for the English | සිංහල buttons in the top bar of the dashboard (beside the menu button on a phone).",
      "Press සිංහල. The menu, buttons, headings and messages change to Sinhala.",
      "Press English to go back.",
    ],
    tips: ["Names (products, customers, Google Place ID, Facebook, TikTok, WhatsApp) stay in English, and so do dates and prices.", "Only the dashboard changes. The website itself, its pages and the orders stay in English."],
    keywords: "language sinhala english translate switch change සිංහල",
  },
  {
    id: "dashboard",
    section: "Getting started",
    question: "What is on the Dashboard page?",
    answer: "A summary of what needs doing: new orders, quotation requests and enquiries waiting for you, and recent activity.",
    steps: ["Open Dashboard from the menu.", "Press any figure to open the list behind it, for example the new orders.", "Work through the new items first: confirm new orders and answer new requests."],
    keywords: "home overview summary today new orders figures activity",
    link: { href: "/app", label: "Dashboard" },
  },
  {
    id: "delay",
    section: "Getting started",
    question: "Why does a change not show on the website straight away?",
    answer: "The website keeps a copy of its pages for a few minutes so that it loads fast. Saving a product updates it at once, but some changes can take up to five minutes.",
    steps: [
      "Save the change and open the page on the website. Refresh it.",
      "If it still shows the old version, wait a few minutes and refresh again.",
      "A material added in the Material window without saving the product can take up to a minute to reach the collection's Material list.",
    ],
    tips: ["If it is still wrong after ten minutes, check that the product is published and has a photo."],
    keywords: "cache old not updating refresh delay slow appear visible live website change",
  },

  // ── Products ───────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "add-product",
    section: "Products",
    question: "How do I add a product?",
    answer: "Open Products, press Add product, fill in the form, press Preview to see how it will look, then confirm.",
    steps: [
      "Open Products and press Add product (top right).",
      "Enter the name and choose the category. Both are needed.",
      "Choose whether it is ready-made or made to order, and write the short description and the detailed description.",
      "Under Specifications, add the Material (every product needs at least one) and anything else that applies, such as the finish.",
      "Under Details, choose Draft or Published, tick Featured or Premium range if you want, set the availability, the price and any discount.",
      "Add the photographs (at least one for a new product).",
      "Press Preview. Check the premium showroom view (if it is premium) and the product page view, then press Confirm and create.",
    ],
    tips: ["A product saved as Draft stays hidden from the website until you publish it.", "The Preview is the real product page drawn small, so what you see there is what visitors will see."],
    keywords: "new create product item furniture piece upload listing sell",
    link: { href: "/app/products/new", label: "Add a product" },
  },
  {
    id: "photos",
    section: "Products",
    question: "How do I add photos, change which part shows, or change their order?",
    answer: "Add photos in the Photos part of the product form. The pencil on a photo lets you drag it and zoom to choose what shows. Drag the photo cards to change their order.",
    steps: [
      "Under Photos, press Add photos and choose the pictures (JPEG, PNG or WebP, up to 8 MB each, up to 5 photos on a product).",
      "Each photo appears as a card in the 4:5 shape used on the website. Photo 1 is the thumbnail on cards and the first photo on the product page.",
      "To choose which part of a photo shows, press the pencil on its card. Drag the picture to move it and use the zoom bar or the plus and minus buttons to zoom in. Press Save.",
      "To change the order, drag a card to a new place. The numbers follow the order the photos have on the product page.",
      "To remove a photo, press the bin on its card.",
      "Press Preview to check, then save the product.",
    ],
    tips: ["Photos are only attached to the product once you save it."],
    keywords: "picture image photograph crop zoom pencil drag order reorder delete remove thumbnail 4:5 position",
    link: { href: "/app/products", label: "Products" },
  },
  {
    id: "price",
    section: "Products",
    question: "How do I set a price, a discount, or availability?",
    answer: "Enter the price in the product form. Add a discount as an amount or a percentage. Leave the price empty to show Price on request.",
    steps: [
      "Enter the regular price. Leave it empty for a piece that cannot be priced easily (timber, for example): visitors then see Price on request and a Request quotation button, and their request reaches you in Quotations, with the product.",
      "For a sale, choose the discount type (amount off or percentage off) and enter the value. The regular price must be filled in first. A percentage must be from 1 to 99, and an amount must be less than the price.",
      "Choose the availability: Available (enter how many only if you want them counted; leave it blank to just show Available), Made to order, or Not available.",
      "Press Preview to check how it looks, then save.",
    ],
    tips: ["Customers see just Available. If you enter an amount and only a few are left, they see, for example, Only 2 left, order soon.", "A piece that is not available shows a disabled Not available button instead of Add to cart."],
    keywords: "cost lkr money sale offer discount percent stock quantity out of stock sold price on request availability",
    link: { href: "/app/products", label: "Products" },
  },
  {
    id: "status",
    section: "Products",
    question: "What do Draft, Published and Archived mean?",
    answer: "Draft: hidden while you work on it. Published: on the website. Archived: hidden and kept on record.",
    steps: [
      "Draft: only you can see it. Use it while you are still writing or waiting for photos.",
      "Published: visitors can see it and buy or ask about it. A published product needs at least one photo.",
      "Archived: taken off the website but kept, so you can bring it back later.",
      "Change the status in the Details part of the product form and save.",
    ],
    keywords: "hide show visible publish unpublish archive draft live remove from website",
    link: { href: "/app/products", label: "Products" },
  },
  {
    id: "premium",
    section: "Products",
    question: "How do I put a product in the Premium range?",
    answer: "Tick both Premium range and Featured on the homepage, publish the product, and keep its description to 160 words or fewer.",
    steps: [
      "Open the product (or add it) and go to Details.",
      "Tick Premium range and Featured on the homepage, and set it to Published.",
      "Write the detailed description. A premium piece can have up to 160 words; a counter under the description shows how many you have used.",
      "Press Preview. The In the premium showroom part shows the photograph beside the description, as it will look on the Premium page.",
      "Confirm and save.",
    ],
    tips: ["The Premium page appears only while at least one product is premium, featured and published. With none, visitors are sent to the Collection.", "On a small screen the end of a long description is cut where the photograph ends, so keep the important words first."],
    keywords: "premium range showroom featured homepage 160 words description limit counter",
    link: { href: "/app/products", label: "Products" },
  },
  {
    id: "specs",
    section: "Products",
    question: "What are Specifications, and why is Material needed?",
    answer: "Specifications are the rows listed under the Specifications tab on the product page. Material is needed on every product because visitors can filter the collection by material.",
    steps: [
      "Under Specifications, the Material row is always first. Pick a suggestion or type a new one and press Enter. A new material is added to the suggestion list when you save the product, and then shows in the collection's Material filter.",
      "Add other rows (such as Finish) from the list of types. Rows with a list of values work the same way as Material.",
      "To remove saved values from a suggestion list, open its window, tick the values and press the red Delete button. The ticks are only for deleting: a ticked box does not mean the value is used.",
    ],
    tips: ["The Material suggestions are the same list that feeds the Material dropdown on the Collection page."],
    keywords: "material wood timber teak finish specification spec suggestion list filter dimensions colour",
    link: { href: "/app/products", label: "Products" },
  },
  {
    id: "bulk",
    section: "Products",
    question: "How do I archive or delete several products at once?",
    answer: "On the Products page press Edit, tick the products, then use Archive or Delete.",
    steps: ["Open Products and press Edit (next to Add product).", "Tick the products you want. You can tick as many as you like.", "Press Archive to hide them and keep them, or Delete to remove them for good (you are asked to confirm).", "Press Done when you have finished."],
    tips: ["Archive if you may want the product again. Delete cannot be undone."],
    keywords: "remove delete archive many multiple select tick bulk edit mode",
    link: { href: "/app/products", label: "Products" },
  },

  // ── Categories ─────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "add-category",
    section: "Categories",
    question: "How do I add a category, and give it a banner picture?",
    answer: "Open Categories and press Add category. A main category can also have a banner picture, which shows as a band on the homepage.",
    steps: [
      "Open Categories and press Add category.",
      "Enter the name and choose whether it is a main category or sits under one.",
      "For a main category, add a banner picture. Press Edit on the picture, drag it to choose which part shows behind the text (the text stays in place), zoom if you like, and press Save.",
      "Save the category. On the homepage the band leads to that category in the Collection.",
    ],
    keywords: "category subcategory group banner picture band homepage background image new",
    link: { href: "/app/categories", label: "Categories" },
  },
  {
    id: "category-order",
    section: "Categories",
    question: "How do I change the order of the main categories?",
    answer: "On the Categories page press Display order and drag the categories into the order you want.",
    steps: ["Open Categories and press Display order.", "Drag the main categories up or down.", "Save. The homepage bands and the Collection menu follow the new order."],
    keywords: "order sort arrange sequence position move up down categories",
    link: { href: "/app/categories", label: "Categories" },
  },

  // ── Orders ─────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "orders",
    section: "Orders",
    question: "What happens when a customer places an order?",
    answer: "It appears in Orders as New and an email goes to the address in Settings. You contact the customer, confirm it, and move it along as it is made and delivered.",
    steps: [
      "A new order shows in Orders with the status New, and on the Dashboard.",
      "Call or message the customer to confirm the details and agree the delivery charge and the day. Customers pay you directly: nothing is paid on the website.",
      "Open the order and move it forward: Confirmed, In production, Ready, then Out for delivery (delivery orders only) and Completed.",
      "Record the payment when you receive it. Customers can follow their order with the order number on the Track order page.",
    ],
    tips: ["The email for new orders is set in Settings (Email for new orders). If it is empty, the business email is used."],
    keywords: "order new customer confirm status production ready delivered completed track email notification",
    link: { href: "/app/orders", label: "Orders" },
  },
  {
    id: "payment",
    section: "Orders",
    question: "How do I record a payment, cancel, or refund an order?",
    answer: "Open the order. Press Mark as paid when the payment arrives, or use the cancel and refund buttons. A refund puts the items back in stock.",
    steps: [
      "Open the order from the Orders list.",
      "When payment arrives (on delivery, by bank transfer, or at the workshop), record it with Mark as paid so the order shows as paid. A payment recorded by mistake can be voided.",
      "To cancel an order, use the cancel button and confirm.",
      "To refund, mark the order as refunded. The items go back into stock. If you did this by mistake, the refund can be undone.",
    ],
    keywords: "pay paid money transfer bank cash refund cancel void undo stock",
    link: { href: "/app/orders", label: "Orders" },
  },
  {
    id: "print",
    section: "Orders",
    question: "How do I print an order or a receipt?",
    answer: "Open the order and press its Print button.",
    steps: ["Open the order.", "Press Print. A clean printable page opens.", "Use your browser's print dialog, or save it as a PDF."],
    keywords: "print receipt invoice pdf paper copy",
    link: { href: "/app/orders", label: "Orders" },
  },

  // ── Quotations and enquiries ───────────────────────────────────────────────────────────────────────────────────
  {
    id: "requests",
    section: "Quotations and enquiries",
    question: "How do I answer a quotation request or an enquiry?",
    answer: "Contact the customer yourself by phone or email, then press Mark as responded. The website does not send replies for you.",
    steps: [
      "Open Quotations (made-to-measure requests) or Enquiries (questions from the contact form and product pages).",
      "Open the new request. The customer's phone number and email are on it.",
      "Call or write to the customer. For a quotation, agree the price and details with them.",
      "Press Mark as responded. Press Move back to new if you need to look at it again.",
    ],
    keywords: "quote quotation enquiry message reply respond answer contact customer phone email made to measure custom",
    link: { href: "/app/quotations", label: "Quotations" },
  },
  {
    id: "customers",
    section: "Quotations and enquiries",
    question: "Where do I find a customer's contact details and history?",
    answer: "Open Customers. It lists everyone who has ordered, asked for a quotation or written to you.",
    steps: ["Open Customers and search by name or phone number.", "Open a customer to see their contact details and their orders, quotations and enquiries."],
    keywords: "customer client person phone number contact history search find",
    link: { href: "/app/customers", label: "Customers" },
  },

  // ── Reviews ────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "reviews",
    section: "Reviews",
    question: "How do I show Google reviews on the homepage?",
    answer: "Reviews are written on Google. Copy a review into the Add a review form and it shows on the homepage straight away.",
    steps: [
      "On Google, copy the reviewer's name, the stars, the date and (if you want) the text.",
      "Open Reviews. In Add a review, enter the name, the number of stars, the date posted and, if you like, the review text (it is optional).",
      "Press Add review. A review already saved is refused.",
      "The newest reviews run in the carousel on the homepage.",
    ],
    tips: ["The Review us on Google button on the website uses the Google Place ID or review link saved in Settings."],
    keywords: "google review rating stars testimonial feedback homepage carousel add copy place id",
    link: { href: "/app/reviews", label: "Reviews" },
  },
  {
    id: "hide-review",
    section: "Reviews",
    question: "How do I hide or delete a review?",
    answer: "On the Reviews page press Edit, tick the reviews, then press Hide to take them off the website (kept) or Delete to remove them for good.",
    steps: ["Open Reviews and press Edit above the saved reviews table.", "Tick the reviews you want. You can tick several, one at a time.", "Press Hide to keep them but take them off the website, or Delete (you are asked to confirm).", "Use the sort menu to order the list by date, name or stars."],
    keywords: "remove hide delete review unpublish sort order stars",
    link: { href: "/app/reviews", label: "Reviews" },
  },

  // ── Gallery ────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "gallery",
    section: "Gallery",
    question: "How do I add or remove gallery photos?",
    answer: "Open Gallery. It shows photos of the workshop. Add photos, and remove any you no longer want.",
    steps: ["Open Gallery.", "Press Add photos and choose up to 10 pictures at a time (it holds up to 30).", "To take a photo away, press Remove under it and confirm. It is deleted from the website and from storage.", "Photos show in the order they were added."],
    tips: ["The four pictures under “Come and see our workshop” on the Contact page are the first four photos here."],
    keywords: "gallery photos pictures workshop order delete upload contact page",
    link: { href: "/app/gallery", label: "Gallery" },
  },

  // ── Settings ───────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "settings",
    section: "Settings",
    question: "Where do I change the phone number, address and opening hours?",
    answer: "Open Settings. The business details there are shown on the website's footer, the Contact page and the product pages.",
    steps: [
      "Open Settings and edit the details: name, short description, telephones, WhatsApp, email, map link, Facebook and TikTok links.",
      "Write the workshop address with one part on each line: the street, the town, the postcode, then the country. Search engines read the town and postcode from it.",
      "Write the opening hours one line per day or range, for example Monday to Saturday: 8:00 am – 5:00 pm and Sunday: Closed.",
      "Add the bank details if customers may pay by transfer: they are shown to them after you confirm the order.",
      "Save each part.",
    ],
    tips: ["Keep the name, address and phone number the same everywhere (website, Google, Facebook): it helps people and search engines trust them."],
    keywords: "settings business name phone telephone whatsapp email address location map hours opening bank details facebook tiktok",
    link: { href: "/app/settings", label: "Settings" },
  },
  {
    id: "place-id",
    section: "Settings",
    question: "What is the Google Place ID, and where do I put it?",
    answer: "It identifies your business on Google. Paste it into Settings so the Review us on Google button opens your review form.",
    steps: ["Find your Place ID on Google (search for Google Place ID finder and look up your business), or copy the review link from your Google Business Profile.", "Open Settings and paste it into Google Place ID (or the review link into Google review link).", "Save. The Review us on Google button on the website now leads to your review page."],
    keywords: "google place id review link business profile maps",
    link: { href: "/app/settings", label: "Settings" },
  },

  // ── When something looks wrong ─────────────────────────────────────────────────────────────────────────────────
  {
    id: "cannot-save",
    section: "When something looks wrong",
    question: "Why can I not save a product?",
    answer: "A message under a field says what is missing. The usual causes are no category, no material, no photo, or a description that is too long for the premium range.",
    steps: [
      "Read the red message under the field and fix that field.",
      "A new product needs a name, a category, at least one material and at least one photo.",
      "The available amount is optional: leave it blank to show just Available. A discount needs the price first.",
      "A premium and featured piece's description can have up to 160 words.",
      "Press Preview again and confirm.",
    ],
    keywords: "error cannot save fail refused message red missing required problem",
  },
  {
    id: "not-showing",
    section: "When something looks wrong",
    question: "Why is a product not showing on the website?",
    answer: "Check that it is published, has at least one photo, and sits in a category that is visible. Then allow a few minutes.",
    steps: [
      "Open the product and check the status is Published, not Draft or Archived.",
      "Check it has at least one photo.",
      "Check its category (and the main category above it) is not archived.",
      "If you changed anything in the database directly, wait up to ten minutes for the website's saved copy to refresh.",
    ],
    keywords: "missing hidden invisible not visible not appearing product website collection premium",
  },
  {
    id: "premium-empty",
    section: "When something looks wrong",
    question: "Why does the Premium page send me to the Collection?",
    answer: "The Premium page only exists while at least one product is premium, featured and published.",
    steps: ["Open a product, tick Premium range and Featured on the homepage, set it to Published and save.", "Open the Premium page again after a minute."],
    keywords: "premium page redirect empty collection showroom",
  },
];
