import { Container, EmptyState, ButtonLink } from '../components/ui'
import { useI18n } from '../lib/i18n/I18nProvider'

export default function NotFoundPage() {
  const { t } = useI18n()
  return (
    <Container className="py-16">
      <EmptyState title={t('nf.title')} action={<ButtonLink to="/">{t('dest.backHome')}</ButtonLink>}>
        <span id="page-title" tabIndex={-1} className="focus:outline-none">{t('nf.text')}</span>
      </EmptyState>
    </Container>
  )
}
