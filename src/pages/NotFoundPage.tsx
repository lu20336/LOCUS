import { Container, EmptyState, ButtonLink } from '../components/ui'

export default function NotFoundPage() {
  return (
    <Container className="py-16">
      <EmptyState title="No encontramos esa página" action={<ButtonLink to="/">Volver al inicio</ButtonLink>}>
        <span id="page-title" tabIndex={-1} className="focus:outline-none">El enlace puede estar mal escrito o la página ya no existe.</span>
      </EmptyState>
    </Container>
  )
}
