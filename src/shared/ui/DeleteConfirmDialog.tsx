import { useEffect, useState } from '@lynx-js/react'
import { useTranslation } from 'react-i18next'

import { SwitchRow } from '../../features/settings/widgets/SwitchRow.js'
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog.js'

interface DeleteConfirmDialogProps extends Omit<ConfirmDialogProps, 'onConfirm'> {
  option?: 'files' | 'orphanSongs'
  /** Reset the opt-in when the target changes while a dialog remains open. */
  targetKey?: string | number
  onConfirm: (deleteRelated: boolean) => void
}

export function DeleteConfirmDialog({
  option,
  targetKey,
  onConfirm,
  ...props
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation()
  const [deleteRelated, setDeleteRelated] = useState(false)
  useEffect(() => {
    setDeleteRelated(false)
  }, [props.show, targetKey, option])
  return (
    <ConfirmDialog {...props} onConfirm={() => onConfirm(option != null && deleteRelated)}>
      {option && (
        <SwitchRow
          title={t(option === 'files' ? 'common.deleteLocalFiles' : 'common.deleteOrphanSongs')}
          subtitle={t('common.deleteRelatedWarning')}
          checked={deleteRelated}
          onChange={setDeleteRelated}
          testId={`${props.testId ?? 'delete'}-related`}
        />
      )}
    </ConfirmDialog>
  )
}
