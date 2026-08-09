import Section from "../../components/ui/Section";

export { default, loader } from "../../components/wishlist/WishlistGallery";

// A lista é específica da sessão e deve ser resolvida com cada navegação para
// refletir a wishlist do usuário atual.
export const eager = true;

export const LoadingFallback = () => <Section.Placeholder height="635px" />;
